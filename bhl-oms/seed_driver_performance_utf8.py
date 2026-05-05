#!/usr/bin/env python3
"""
Migration runner + Data seeding for driver performance tracking
Chay migration 012 va seed lich su du lieu cho:
1. driver_scorecards - bang diem lai
2. driver_leaderboards - bang xep hang
3. vehicle_health - suc khoe xe
4. vehicle_tco - chi phi tong hop
5. driver_vehicle_assignments - lich gan lai xe
"""

import psycopg2
import sys
from datetime import datetime, timedelta
from decimal import Decimal
import random

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
        print("[ERROR] DB connection failed: {}".format(e))
        sys.exit(1)

def run_migration(conn):
    """Chay migration 012"""
    cursor = conn.cursor()
    try:
        print("[INFO] Running migration 012...")
        
        # Check if tables already exist
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'driver_scorecards'
            )
        """)
        table_exists = cursor.fetchone()[0]
        
        if table_exists:
            print("[INFO] Tables already exist, skipping migration")
            return
        
        # Read migration SQL
        with open('migrations/012_driver_performance_tracking.up.sql', 'r', encoding='utf-8') as f:
            sql = f.read()
        
        cursor.execute(sql)
        conn.commit()
        print("[OK] Migration 012 success")
        
    except Exception as e:
        conn.rollback()
        print("[ERROR] Migration failed: {}".format(e))
        raise
    finally:
        cursor.close()

def seed_driver_scorecards(conn):
    """
    Seed driver_scorecards - 90 days history
    """
    cursor = conn.cursor()
    try:
        print("[INFO] Seeding driver_scorecards...")
        
        # Get active drivers
        cursor.execute("SELECT id FROM drivers WHERE status='active' LIMIT 50")
        drivers = [row[0] for row in cursor.fetchall()]
        
        if not drivers:
            print("[WARN] No active drivers")
            return
        
        # History from 90 days ago to today
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
                    int(deliveries - success),
                    rejections,
                    random.randint(0, 2),
                    on_time_ratio,
                    damages,
                    random.randint(0, 2),
                    random.randint(0, 1),
                    random.randint(0, 1),
                    raw_score,
                    min(100, raw_score * random.uniform(0.8, 1.0))
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
        ON CONFLICT DO NOTHING
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print("[OK] Seeded {} daily scorecards".format(len(inserts)))
        
    except Exception as e:
        conn.rollback()
        print("[ERROR] Seeding scorecards failed: {}".format(e))
        raise
    finally:
        cursor.close()

def seed_driver_leaderboards(conn):
    """
    Seed driver_leaderboards - weekly, monthly, quarterly
    """
    cursor = conn.cursor()
    try:
        print("[INFO] Seeding driver_leaderboards...")
        
        # Get drivers
        cursor.execute("SELECT id FROM drivers WHERE status='active' LIMIT 50")
        drivers = [row[0] for row in cursor.fetchall()]
        
        if not drivers:
            return
        
        inserts = []
        now = datetime.now().date()
        
        # Weekly leaderboards - 12 weeks
        for weeks_ago in range(12):
            period_end = now - timedelta(weeks=weeks_ago)
            period_start = period_end - timedelta(weeks=1)
            
            # Shuffle and rank drivers
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
                    random.randint(4, 20),
                    random.randint(20, 100),
                    random.uniform(85, 99),
                    tier
                ))
        
        # Monthly leaderboards - 12 months
        for months_ago in range(12):
            month_offset = months_ago
            year_offset = 0
            if month_offset >= 12:
                year_offset = month_offset // 12
                month_offset = month_offset % 12
            
            month = now.month - month_offset
            year = now.year - year_offset
            if month <= 0:
                month += 12
                year -= 1
            
            period_end = datetime(year, month, 1).date()
            if month == 12:
                period_start = datetime(year, month, 1).date()
            else:
                days_in_month = (datetime(year, month + 1, 1) - timedelta(days=1)).day
                period_start = datetime(year, month, 1).date()
                period_end = datetime(year, month, days_in_month).date()
            
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
                    random.randint(15, 80),
                    random.randint(80, 300),
                    random.uniform(85, 99),
                    tier
                ))
        
        insert_sql = """
        INSERT INTO driver_leaderboards (
            driver_id, period_type, period_start_date, period_end_date,
            rank, total_drivers_ranked, avg_score, trips_completed,
            deliveries_total, success_rate, tier
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print("[OK] Seeded {} leaderboard entries".format(len(inserts)))
        
    except Exception as e:
        conn.rollback()
        print("[ERROR] Seeding leaderboards failed: {}".format(e))
        raise
    finally:
        cursor.close()

def seed_vehicle_health(conn):
    """
    Seed vehicle_health - daily health metrics
    """
    cursor = conn.cursor()
    try:
        print("[INFO] Seeding vehicle_health...")
        
        # Get active vehicles
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
                
                overall = (engine + transmission + tires + brakes + electrical + body + cleanliness) / 7.0
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
                    random.randint(5, 90),
                    Decimal(str(random.randint(100000, 500000))),
                    overall,
                    status,
                    current_date,
                    odometer,
                    Decimal(str(random.uniform(6, 9)))
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
        ON CONFLICT DO NOTHING
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print("[OK] Seeded {} vehicle health records".format(len(inserts)))
        
    except Exception as e:
        conn.rollback()
        print("[ERROR] Seeding vehicle health failed: {}".format(e))
        raise
    finally:
        cursor.close()

def seed_vehicle_tco(conn):
    """
    Seed vehicle_tco - daily TCO data
    """
    cursor = conn.cursor()
    try:
        print("[INFO] Seeding vehicle_tco...")
        
        # Get active vehicles
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
                insurance = Decimal('500000')
                depreciation = Decimal('3000000')
                
                total_cost = fuel_cost + maintenance + insurance + depreciation
                # NUMERIC(8,4) means max 9999.9999, so limit to 4 digits
                cost_per_km = min(Decimal('9999'), total_cost / Decimal(distance)) if distance > 0 else 0
                fuel_cost_per_km = min(Decimal('9999'), fuel_cost / Decimal(distance)) if distance > 0 else 0
                
                inserts.append((
                    vehicle_id,
                    'daily',
                    current_date,
                    fuel_cost,
                    maintenance,
                    Decimal(str(random.randint(0, 200000))),
                    Decimal(str(random.randint(50000, 300000))),
                    Decimal(str(random.randint(50000, 500000))),
                    Decimal(str(random.randint(100000, 500000))),
                    insurance,
                    Decimal(str(random.randint(0, 100000))),
                    Decimal(str(random.randint(0, 200000))),
                    Decimal(str(random.randint(0, 500000))),
                    depreciation,
                    Decimal(str(random.randint(0, 500000))),
                    distance,
                    trips,
                    fuel_liters,
                    fuel_cost_per_km,
                    cost_per_km,
                    total_cost,
                    Decimal(str(random.uniform(0.4, 0.7)))
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
        ON CONFLICT DO NOTHING
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print("[OK] Seeded {} TCO records".format(len(inserts)))
        
    except Exception as e:
        conn.rollback()
        print("[ERROR] Seeding TCO failed: {}".format(e))
        raise
    finally:
        cursor.close()

def seed_driver_vehicle_assignments(conn):
    """
    Seed driver_vehicle_assignments - assignment history
    """
    cursor = conn.cursor()
    try:
        print("[INFO] Seeding driver_vehicle_assignments...")
        
        # Get drivers and vehicles
        cursor.execute("SELECT id FROM drivers WHERE status='active' ORDER BY RANDOM() LIMIT 50")
        drivers = [row[0] for row in cursor.fetchall()]
        
        cursor.execute("SELECT id FROM vehicles WHERE status='active' ORDER BY RANDOM() LIMIT 30")
        vehicles = [row[0] for row in cursor.fetchall()]
        
        if not drivers or not vehicles:
            print("[WARN] Not enough drivers or vehicles")
            return
        
        inserts = []
        base_date = datetime.now().date() - timedelta(days=180)
        
        # Assign vehicles to high-usage drivers
        for idx, driver_id in enumerate(drivers[:30]):
            # Each driver gets 1-2 vehicles
            assigned_vehicles = random.sample(vehicles, k=random.randint(1, 2))
            
            for vehicle_id in assigned_vehicles:
                assignment_date = base_date + timedelta(days=random.randint(0, 150))
                unassignment_date = assignment_date + timedelta(days=random.randint(30, 150))
                
                # Some are still active
                if random.random() > 0.3:
                    unassignment_date = None
                
                inserts.append((
                    driver_id,
                    vehicle_id,
                    assignment_date,
                    unassignment_date,
                    random.choice(['high_usage', 'promotion', 'maintenance', 'performance']),
                    random.randint(30, 150),
                    Decimal(str(random.randint(5000000, 50000000))),
                    Decimal(str(random.randint(2000000, 20000000))),
                    Decimal(str(random.uniform(70, 95)))
                ))
        
        insert_sql = """
        INSERT INTO driver_vehicle_assignments (
            driver_id, vehicle_id, assignment_date, unassignment_date, reason,
            trips_completed, revenue_generated, cost_incurred, avg_score
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        """
        
        cursor.executemany(insert_sql, inserts)
        conn.commit()
        print("[OK] Seeded {} driver-vehicle assignments".format(len(inserts)))
        
    except Exception as e:
        conn.rollback()
        print("[ERROR] Seeding assignments failed: {}".format(e))
        raise
    finally:
        cursor.close()

def main():
    conn = get_connection()
    try:
        # 1. Run migration
        run_migration(conn)
        
        # 2. Seed historical data
        seed_driver_scorecards(conn)
        seed_driver_leaderboards(conn)
        seed_vehicle_health(conn)
        seed_vehicle_tco(conn)
        seed_driver_vehicle_assignments(conn)
        
        print("\n" + "="*60)
        print("[SUCCESS] All migrations + seed data complete!")
        print("="*60)
        print("Historical data ready for:")
        print("  1. Driver leaderboard (weekly/monthly/quarterly)")
        print("  2. Driver scorecard (daily/weekly/monthly)")
        print("  3. Vehicle TCO (cost tracking)")
        print("  4. Vehicle health (health metrics)")
        print("  5. Driver-vehicle assignments (usage history)")
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()
