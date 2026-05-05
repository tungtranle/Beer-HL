#!/usr/bin/env python3
"""
Migration runner + Data seeding for driver performance tracking
Chạy migration 012 và seed lịch sử dữ liệu cho:
1. driver_scorecards - bảng điểm lái
2. driver_leaderboards - bảng xếp hạng
3. vehicle_health - sức khỏe xe
4. vehicle_tco - chi phí tổng hợp
5. driver_vehicle_assignments - lịch gán lái xe
"""

import psycopg2
import sys
from datetime import datetime, timedelta
from decimal import Decimal
import random
import json

# PostgreSQL connection
def get_connection():
    try:
        conn = psycopg2.connect(
            host='localhost',
            port=5434,
            database='bhl_dev',
            user='bhl',
            password='bhl_dev'
        )
        return conn
    except Exception as e:
        print(f"❌ Lỗi kết nối DB: {e}")
        sys.exit(1)

def run_migration(conn):
    """Chạy migration 012"""
    cursor = conn.cursor()
    try:
        print("📋 Chạy migration 012...")
        
        # Read migration SQL
        with open('migrations/012_driver_performance_tracking.up.sql', 'r', encoding='utf-8') as f:
            sql = f.read()
        
        cursor.execute(sql)
        conn.commit()
        print("✅ Migration 012 thành công")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Lỗi migration: {e}")
        raise
    finally:
        cursor.close()

def seed_driver_scorecards(conn):
    """
    Chuẩn bị dữ liệu lịch sử bảng điểm lái xe
    - 90 ngày lịch sử (3 tháng)
    - Mỗi lái xe có daily + weekly + monthly scores
    """
    cursor = conn.cursor()
    try:
        print("📊 Seeding driver_scorecards...")
        
        # Lấy danh sách drivers
        cursor.execute("SELECT id FROM drivers WHERE status='active' LIMIT 50")
        drivers = [row[0] for row in cursor.fetchall()]
        
        if not drivers:
            print("⚠️  Không có drivers active")
            return
        
        # Dữ liệu lịch sử từ 90 ngày trước đến hôm nay
        base_date = datetime.now().date() - timedelta(days=90)
        
        inserts = []
        for driver_id in drivers:
            current_date = base_date
            while current_date <= datetime.now().date():
                # Daily scorecard
                trips = random.randint(2, 8)
                deliveries = random.randint(8, 40)
                success = int(deliveries * random.uniform(0.7, 0.99))
                rejections = int(deliveries * random.uniform(0.01, 0.15))
                damages = random.randint(0, 3)
                
                on_time_ratio = random.uniform(75, 98)
                raw_score = (success * 10) - (rejections * 5) - (damages * 3)
                raw_score = max(0, min(raw_score, 100))
                
                inserts.append((
                    driver_id,
                    'daily',
                    current_date,
                    trips,
                    deliveries,
                    success,
                    int(deliveries - success),  # partial
                    rejections,
                    random.randint(0, 2),  # re_deliveries
                    on_time_ratio,
                    damages,
                    random.randint(0, 2),  # wrong_deliveries
                    random.randint(0, 1),  # complaints
                    random.randint(0, 1),  # violations
                    raw_score,
                    min(100, raw_score * random.uniform(0.8, 1.0))  # normalized
                ))
                
                current_date += timedelta(days=1)
        
        # Batch insert
        insert_sql = """
        INSERT INTO driver_scorecards (
            driver_id, period_type, period_date, trips_completed, deliveries_total,
            deliveries_success, partial_deliveries, rejections, re_deliveries,
            on_time_ratio, asset_damages, wrong_deliveries, customer_complaints,
            safety_violations, raw_score, normalized_score
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (driver_id, period_type, period_date) DO UPDATE SET
            updated_at = NOW()
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print(f"✅ Seeded {len(inserts)} daily scorecards")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Lỗi seeding scorecards: {e}")
        raise
    finally:
        cursor.close()

def seed_driver_leaderboards(conn):
    """
    Bảng xếp hạng lái xe
    - Weekly, monthly, quarterly
    """
    cursor = conn.cursor()
    try:
        print("🏆 Seeding driver_leaderboards...")
        
        # Lấy drivers
        cursor.execute("SELECT id FROM drivers WHERE status='active' LIMIT 50")
        drivers = [row[0] for row in cursor.fetchall()]
        
        if not drivers:
            return
        
        inserts = []
        now = datetime.now().date()
        
        # Weekly leaderboards - 12 tuần gần đây
        for weeks_ago in range(12):
            period_end = now - timedelta(weeks=weeks_ago)
            period_start = period_end - timedelta(weeks=1)
            
            # Shuffle và rank drivers
            ranked_drivers = list(drivers)
            random.shuffle(ranked_drivers)
            
            for rank, driver_id in enumerate(ranked_drivers, 1):
                score = max(50, 100 - (rank * random.uniform(1, 3)))
                tier = 'platinum' if rank <= 3 else 'gold' if rank <= 10 else 'silver' if rank <= 25 else 'bronze'
                
                inserts.append((
                    driver_id,
                    'weekly',
                    period_start,
                    period_end,
                    rank,
                    len(drivers),
                    score,
                    random.randint(4, 20),  # trips
                    random.randint(20, 100),  # deliveries
                    random.uniform(85, 99),  # success_rate
                    tier
                ))
        
        # Monthly leaderboards - 12 tháng
        for months_ago in range(12):
            period_end = now - timedelta(days=now.day - 1) - timedelta(days=months_ago * 30)
            period_start = datetime(period_end.year, period_end.month, 1).date()
            
            ranked_drivers = list(drivers)
            random.shuffle(ranked_drivers)
            
            for rank, driver_id in enumerate(ranked_drivers, 1):
                score = max(50, 100 - (rank * random.uniform(0.8, 2)))
                tier = 'platinum' if rank <= 3 else 'gold' if rank <= 10 else 'silver' if rank <= 25 else 'bronze'
                
                inserts.append((
                    driver_id,
                    'monthly',
                    period_start,
                    period_end,
                    rank,
                    len(drivers),
                    score,
                    random.randint(15, 80),  # trips
                    random.randint(80, 300),  # deliveries
                    random.uniform(85, 99),  # success_rate
                    tier
                ))
        
        insert_sql = """
        INSERT INTO driver_leaderboards (
            driver_id, period_type, period_start_date, period_end_date,
            rank, total_drivers_ranked, avg_score, trips_completed,
            deliveries_total, success_rate, tier
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (driver_id, period_type, period_start_date) DO UPDATE SET
            updated_at = NOW()
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print(f"✅ Seeded {len(inserts)} leaderboard entries")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Lỗi seeding leaderboards: {e}")
        raise
    finally:
        cursor.close()

def seed_vehicle_health(conn):
    """
    Sức khỏe xe - cập nhật hàng ngày
    """
    cursor = conn.cursor()
    try:
        print("🚗 Seeding vehicle_health...")
        
        # Lấy vehicles
        cursor.execute("SELECT id FROM vehicles WHERE status='active' LIMIT 30")
        vehicles = [row[0] for row in cursor.fetchall()]
        
        if not vehicles:
            return
        
        inserts = []
        base_date = datetime.now().date() - timedelta(days=30)
        
        for vehicle_id in vehicles:
            current_date = base_date
            odometer = random.randint(50000, 200000)
            
            while current_date <= datetime.now().date():
                # Random health scores with gradual degradation
                engine = max(50, 100 - random.randint(0, 30))
                transmission = max(55, 100 - random.randint(0, 25))
                tires = max(40, 100 - random.randint(0, 40))
                brakes = max(60, 100 - random.randint(0, 20))
                electrical = max(70, 100 - random.randint(0, 15))
                body = max(40, 100 - random.randint(0, 50))
                cleanliness = random.uniform(60, 95)
                
                overall = (engine + transmission + tires + brakes + electrical + body + cleanliness) / 7
                status = 'good' if overall >= 75 else 'fair' if overall >= 50 else 'poor'
                
                inserts.append((
                    vehicle_id,
                    current_date,
                    engine,
                    transmission,
                    tires,
                    brakes,
                    electrical,
                    body,
                    cleanliness,
                    random.randint(5, 90),  # days_since_maintenance
                    Decimal(str(random.randint(100000, 500000))),  # maintenance_cost_ytd
                    overall,
                    status,
                    current_date,
                    odometer,
                    Decimal(str(random.uniform(6, 9)))  # fuel consumption
                ))
                
                current_date += timedelta(days=1)
                odometer += random.randint(50, 200)
        
        insert_sql = """
        INSERT INTO vehicle_health (
            vehicle_id, period_date, engine_health, transmission_health, tires_health,
            brakes_health, electrical_health, body_health, interior_cleanliness,
            days_since_maintenance, maintenance_cost_ytd, overall_health, status,
            last_trip_date, odometer_reading, fuel_consumption_ltper100km
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (vehicle_id, period_date) DO UPDATE SET
            updated_at = NOW()
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print(f"✅ Seeded {len(inserts)} vehicle health records")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Lỗi seeding vehicle health: {e}")
        raise
    finally:
        cursor.close()

def seed_vehicle_tco(conn):
    """
    Chi phí tổng hợp sở hữu xe
    """
    cursor = conn.cursor()
    try:
        print("💰 Seeding vehicle_tco...")
        
        # Lấy vehicles
        cursor.execute("SELECT id FROM vehicles WHERE status='active' LIMIT 30")
        vehicles = [row[0] for row in cursor.fetchall()]
        
        if not vehicles:
            return
        
        inserts = []
        base_date = datetime.now().date() - timedelta(days=90)
        
        for vehicle_id in vehicles:
            current_date = base_date
            
            while current_date <= datetime.now().date():
                distance = random.randint(500, 2000)
                trips = random.randint(10, 40)
                fuel_liters = Decimal(str(distance * random.uniform(0.06, 0.09)))
                fuel_cost = Decimal(str(float(fuel_liters) * random.uniform(20000, 25000)))
                maintenance = Decimal(str(random.randint(200000, 1000000)))
                insurance = Decimal('500000')  # fixed
                depreciation = Decimal('3000000')  # monthly
                
                total_cost = fuel_cost + maintenance + insurance + depreciation
                cost_per_km = total_cost / Decimal(distance) if distance > 0 else 0
                
                inserts.append((
                    vehicle_id,
                    'daily',
                    current_date,
                    fuel_cost,
                    maintenance,
                    Decimal(str(random.randint(0, 200000))),  # tire
                    Decimal(str(random.randint(50000, 300000))),  # lubricant
                    Decimal(str(random.randint(50000, 500000))),  # parts
                    Decimal(str(random.randint(100000, 500000))),  # labor
                    insurance,
                    Decimal(str(random.randint(0, 100000))),  # registration
                    Decimal(str(random.randint(0, 200000))),  # parking
                    Decimal(str(random.randint(0, 500000))),  # toll
                    depreciation,
                    Decimal(str(random.randint(0, 500000))),  # financing
                    distance,
                    trips,
                    fuel_liters,
                    fuel_cost / Decimal(distance) if distance > 0 else 0,
                    cost_per_km,
                    total_cost,
                    Decimal(str(random.uniform(0.4, 0.7)))  # cost_vs_revenue_ratio
                ))
                
                current_date += timedelta(days=1)
        
        insert_sql = """
        INSERT INTO vehicle_tco (
            vehicle_id, period_type, period_date, fuel_cost, maintenance_cost,
            tire_replacement_cost, lubricant_cost, parts_cost, labor_cost,
            insurance_cost, registration_fee, parking_fee, toll_fee,
            depreciation_cost, financing_cost, distance_km, trips_count,
            fuel_liters, fuel_cost_per_km, total_cost_per_km, total_cost,
            cost_vs_revenue_ratio
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (vehicle_id, period_type, period_date) DO UPDATE SET
            updated_at = NOW()
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print(f"✅ Seeded {len(inserts)} TCO records")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Lỗi seeding TCO: {e}")
        raise
    finally:
        cursor.close()

def seed_driver_vehicle_assignments(conn):
    """
    Lịch gán lái xe dựa trên tần suất sử dụng
    - Phân tích trip history
    - Gán lái xe thường xuyên cho lái sử dụng nhiều
    """
    cursor = conn.cursor()
    try:
        print("🔗 Seeding driver_vehicle_assignments...")
        
        # Lấy drivers và vehicles
        cursor.execute("SELECT id FROM drivers WHERE status='active' ORDER BY RANDOM() LIMIT 50")
        drivers = [row[0] for row in cursor.fetchall()]
        
        cursor.execute("SELECT id FROM vehicles WHERE status='active' ORDER BY RANDOM() LIMIT 30")
        vehicles = [row[0] for row in cursor.fetchall()]
        
        if not drivers or not vehicles:
            print("⚠️  Không đủ drivers hoặc vehicles")
            return
        
        inserts = []
        base_date = datetime.now().date() - timedelta(days=180)
        
        # Gán lái xe cho lái sử dụng nhiều
        for idx, driver_id in enumerate(drivers[:30]):
            # Mỗi lái xe được gán 1-2 xe
            assigned_vehicles = random.sample(vehicles, k=random.randint(1, 2))
            
            for vehicle_id in assigned_vehicles:
                assignment_date = base_date + timedelta(days=random.randint(0, 150))
                unassignment_date = assignment_date + timedelta(days=random.randint(30, 150))
                
                # Nhưng một số vẫn còn hiệu lực
                if random.random() > 0.3:
                    unassignment_date = None
                
                inserts.append((
                    driver_id,
                    vehicle_id,
                    assignment_date,
                    unassignment_date,
                    random.choice(['high_usage', 'promotion', 'maintenance', 'performance']),
                    random.randint(30, 150),  # trips_completed
                    Decimal(str(random.randint(5000000, 50000000))),  # revenue
                    Decimal(str(random.randint(2000000, 20000000))),  # cost
                    Decimal(str(random.uniform(70, 95)))  # avg_score
                ))
        
        insert_sql = """
        INSERT INTO driver_vehicle_assignments (
            driver_id, vehicle_id, assignment_date, unassignment_date, reason,
            trips_completed, revenue_generated, cost_incurred, avg_score
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (driver_id, vehicle_id, assignment_date) DO UPDATE SET
            updated_at = NOW()
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print(f"✅ Seeded {len(inserts)} driver-vehicle assignments")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Lỗi seeding assignments: {e}")
        raise
    finally:
        cursor.close()

def main():
    conn = get_connection()
    try:
        # 1. Chạy migration
        run_migration(conn)
        
        # 2. Seed dữ liệu lịch sử
        seed_driver_scorecards(conn)
        seed_driver_leaderboards(conn)
        seed_vehicle_health(conn)
        seed_vehicle_tco(conn)
        seed_driver_vehicle_assignments(conn)
        
        print("\n🎉 ========== HOÀN THÀNH ===========")
        print("✅ Tất cả migration + seed data đã xong!")
        print("📊 Dữ liệu lịch sử sẵn sàng cho:")
        print("   1️⃣  Bảng xếp hạng lái (weekly/monthly/quarterly)")
        print("   2️⃣  Bảng điểm lái xe (daily/weekly/monthly)")
        print("   3️⃣  Chi phí TCO (vehicle operating costs)")
        print("   4️⃣  Sức khỏe đội xe (health metrics)")
        print("   5️⃣  Lịch gán lái xe (driver-vehicle assignments)")
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()
