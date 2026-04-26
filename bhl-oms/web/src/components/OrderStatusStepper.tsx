'use client'

import { orderProgressSteps, orderSpecialStatuses, getOrderStepIndex, isSpecialStatus, getStatusLabel } from '@/lib/status-config'

interface Props {
  status: string
}

/**
 * Thanh tiến trình đơn hàng E2E — world-class UX
 * 5 bước chính: Tạo đơn → Xác nhận → Kho xử lý → Vận chuyển → Hoàn thành
 * Hiển thị trạng thái CỤ THỂ bên dưới bước đang active (ví dụ: "Đang soạn hàng")
 * Trạng thái đặc biệt (từ chối, giao một phần, hủy...) hiện riêng bên dưới
 */
export function OrderStatusStepper({ status }: Props) {
  const isSpecial = isSpecialStatus(status)
  const currentStep = getOrderStepIndex(status)
  const specialInfo = isSpecial ? orderSpecialStatuses[status] : null
  const currentStatusLabel = getStatusLabel(status)

  return (
    <div className="w-full">
      {/* Main progress stepper */}
      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full mx-8" />
        {/* Progress bar fill */}
        <div
          className="absolute top-5 left-0 h-1 bg-[#F68634] rounded-full mx-8 transition-all duration-700 ease-out"
          style={{
            width: isSpecial
              ? `${Math.max(0, ((currentStep) / (orderProgressSteps.length - 1)) * 100)}%`
              : `${(currentStep / (orderProgressSteps.length - 1)) * 100}%`,
            maxWidth: 'calc(100% - 4rem)',
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {orderProgressSteps.map((step, idx) => {
            const isCompleted = idx < currentStep || (idx === currentStep && status === 'delivered')
            const isCurrent = idx === currentStep && !isSpecial && status !== 'delivered'
            const _isUpcoming = idx > currentStep

            return (
              <div key={step.key} className="flex flex-col items-center" style={{ width: `${100 / orderProgressSteps.length}%` }}>
                {/* Circle */}
                <div
                  className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500
                    ${isCompleted
                      ? 'bg-[#F68634] border-[#F68634] text-white shadow-md shadow-orange-200'
                      : isCurrent
                        ? 'bg-white border-[#F68634] text-[#F68634] shadow-lg shadow-orange-200 ring-4 ring-orange-100'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-lg">{step.icon}</span>
                  )}

                  {/* Pulse animation for current step */}
                  {isCurrent && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-[#F68634] opacity-20" />
                  )}
                </div>

                {/* Label */}
                <span className={`mt-2 text-xs font-semibold text-center leading-tight
                  ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </span>

                {/* Current specific status — show actual status name, not just step name */}
                {isCurrent && (
                  <span className="mt-0.5 text-[10px] text-[#F68634] text-center leading-tight font-medium">
                    {currentStatusLabel}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Special status banner (rejection, partial, cancelled, etc.) */}
      {specialInfo && (
        <div className={`mt-4 flex items-center gap-3 p-3 rounded-lg border ${specialInfo.color}`}>
          <span className="text-2xl">{specialInfo.icon}</span>
          <div>
            <span className="font-semibold">{specialInfo.label}</span>
            <p className="text-sm opacity-80">{specialInfo.description}</p>
          </div>
        </div>
      )}

      {/* Delivered success banner */}
      {status === 'delivered' && (
        <div className="mt-4 flex items-center gap-3 p-3 rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
          <span className="text-2xl">🎉</span>
          <div>
            <span className="font-semibold">Giao hàng thành công</span>
            <p className="text-sm opacity-80">Đơn hàng đã được giao đến NPP</p>
          </div>
        </div>
      )}
    </div>
  )
}
