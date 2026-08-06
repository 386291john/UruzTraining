'use client'

import { AffiliateForm } from '@/components/affiliates/affiliate-form'

/**
 * Registration page for new affiliates.
 *
 * Validates: Requirements 3.1, 4.1, 4.2, 4.3, 7.1
 */
export default function NewAffiliatePage() {
  return (
    <div className="space-y-6">
      <AffiliateForm />
    </div>
  )
}
