"use client";
/* eslint-disable @next/next/no-img-element */
import Footer from "@/core/common/footer/footer";
import PageHeader from "@/core/common/page-header/pageHeader";
import Link from "next/link";
import { all_routes } from "@/router/all_routes";
import { useState, useEffect, type ReactNode } from "react";
import type { NormalizedScarlettDeal } from "@/core/types/scarlettDeal";
import ModalDealsDetails from "./modal/modalDealsDetails";

interface DealsDetailsProps {
  dealKey?: string;
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmt(value: any, type: 'currency' | 'date' | 'pct' | 'months' | 'text' = 'text'): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'currency') {
    const n = Number(value);
    return isNaN(n) || n === 0 ? '—' : `$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
  }
  if (type === 'date') {
    try { return new Date(value).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return String(value); }
  }
  if (type === 'pct') {
    const n = Number(value);
    return isNaN(n) || n === 0 ? '—' : `${n.toFixed(2)}%`;
  }
  if (type === 'months') {
    const n = Number(value);
    if (isNaN(n) || n <= 0) return '—';
    const yrs = Math.floor(n / 12), mo = n % 12;
    return yrs > 0 ? (mo > 0 ? `${yrs} yr ${mo} mo` : `${yrs} yr`) : `${mo} mo`;
  }
  return String(value);
}

// Stages in pipeline order
const PIPELINE_STAGES = [
  { key: 'New',               color: 'bg-secondary' },
  { key: 'Work in Progress',  color: 'bg-info'      },
  { key: 'Submitted',         color: 'bg-primary'   },
  { key: 'Compliance Review', color: 'bg-warning'   },
  { key: 'Approved',          color: 'bg-teal'      },
  { key: 'Ready to Close',    color: 'bg-orange'    },
  { key: 'Closed / Funded',   color: 'bg-success'   },
  { key: 'Paid & Finalized',  color: 'bg-purple'    },
];
const TERMINAL_MAP: Record<string, { label: string; cls: string }> = {
  Cancelled: { label: 'Cancelled', cls: 'badge bg-danger' },
  Declined:  { label: 'Declined',  cls: 'badge bg-danger' },
  Renewed:   { label: 'Renewed',   cls: 'badge bg-teal'   },
};

// Small reusable row for sidebar info tables (hides if no value)
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === '—') return null;
  return (
    <div className="d-flex align-items-start justify-content-between mb-2 gap-2">
      <span className="text-muted" style={{ fontSize: 12, minWidth: '42%' }}>{label}</span>
      <span className="text-dark fw-medium text-end" style={{ fontSize: 12 }}>{value}</span>
    </div>
  );
}

// Always-visible row (shows '—' when empty) — used for management fields
function InfoField({ label, value, badge }: { label: string; value?: string | null; badge?: ReactNode }) {
  return (
    <div className="d-flex align-items-start justify-content-between mb-2 gap-2">
      <span className="text-muted" style={{ fontSize: 12, minWidth: '55%' }}>{label}</span>
      <span className="text-dark fw-medium text-end" style={{ fontSize: 12 }}>
        {badge ?? (value && value !== '—' ? value : <span className="text-muted fst-italic">—</span>)}
      </span>
    </div>
  );
}

// Section header inside a card
function SectionHead({ icon, title }: { icon: string; title: string }) {
  return (
    <h6 className="fw-semibold mb-3 d-flex align-items-center gap-1">
      <i className={`ti ${icon} text-primary`} />
      {title}
    </h6>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const DealsDetailsComponent = ({ dealKey }: DealsDetailsProps) => {
  const [deal, setDeal]       = useState<NormalizedScarlettDeal | null>(null);
  const [loading, setLoading] = useState(!!dealKey);
  const [selectedApplicantIdx, setSelectedApplicantIdx] = useState(0);
  const [activeLeftTab, setActiveLeftTab] = useState<'compliance' | 'accounting'>('compliance');

  useEffect(() => {
    if (!dealKey) return;
    (async () => {
      try {
        const res  = await fetch(`/api/scarlett-deals?key=${encodeURIComponent(dealKey)}`);
        const json = await res.json();
        if (json.success && json.data?.length > 0) setDeal(json.data[0]);
      } catch (e) {
        console.error('[DealsDetailsComponent] fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [dealKey]);

  // ── Extract rich data from _raw ──────────────────────────────────────────────
  const raw          = (deal?._raw ?? {}) as any;
  const app          = raw?.MortgageApplication    ?? {};
  const dealObj      = app?.MortgageDeal            ?? {};
  const subjectProp  = raw?.SubjectProperty         ?? {};
  const propMort     = subjectProp?.PropertyMortgage ?? {};
  const reqMortgages : any[] = propMort?.RequestedMortgages ?? [];
  const reqMort      = reqMortgages[reqMortgages.length - 1] ?? {};
  const agentOnDeal  = app?.AgentOnDeal             ?? {};
  const dealOwnerContact = dealObj?.DealOwner?.Contact ?? {};
  const applicantGroups: any[] = raw?.ApplicantGroups ?? [];
  const allApplicants: any[]   = applicantGroups.flatMap((g: any) => g?.Applicants ?? []);
  const finGroup     = applicantGroups[0] ?? {};

  // Display name / initials
  const dealName = deal?.DealName ?? 'Unknown Borrower';
  const initials = dealName.split(' ').map((w: string) => w[0] ?? '').join('').substring(0, 2).toUpperCase();
  const stage    = deal?.Stage  ?? '';
  const status   = deal?.Status ?? 'Open';
  const tags     = deal ? (Array.isArray(deal.Tags) ? deal.Tags : [deal.Tags]).filter(Boolean) : [];

  // Application info
  const appNumber  = dealObj?.ApplicationNumber ?? deal?.ApplicationNumber ?? '';
  const appDate    = fmt(app?.ApplicationDate,  'date');
  const lastUpdate = fmt(app?.LastUpdate,       'date');
  const purpose    = dealObj?.strDealPurpose     ?? '';
  const appType    = dealObj?.strApplicationType ?? '';
  const appStatus  = app?.strMortgageApplicationStatus ?? stage;

  // Loan / mortgage
  const rawLoanAmt   = reqMort?.TotalLoanAmount ?? reqMort?.Balance ?? reqMort?.RequestedMortgageAmount;
  const loanAmt      = fmt(rawLoanAmt, 'currency');
  const interestRate = reqMort?.InterestRate != null ? `${Number(reqMort.InterestRate).toFixed(2)}%` : '—';
  const paymentVal   = reqMort?.Payment ?? reqMort?.PAndIPayment;
  const monthlyPay   = paymentVal != null
    ? `$${Number(paymentVal).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
  const termMonths  = reqMort?.TermInMonth  ?? reqMort?.TermMonths;
  const amortMonths = reqMort?.AmortizationInMonth;
  const rateType    = [reqMort?.strRateType, reqMort?.strTermType].filter((v) => v && v !== '').join(' — ') || '—';
  const mortType    = reqMort?.strMortgageType ?? '—';
  const maturity    = fmt(reqMort?.MaturityDate,     'date');
  const firstPayment= fmt(reqMort?.FirstPaymentDate, 'date');
  const payFreq     = reqMort?.strPaymentFrequency   ?? '—';
  const interestOnly= reqMort?.InterestOnlyFlag === true;

  // Ratios
  const ltv = fmt(dealObj?.CombinedLTV, 'pct');
  const gds = fmt(dealObj?.CombinedGDS, 'pct');
  const tds = fmt(dealObj?.CombinedTDS, 'pct');

  // Property
  const propAddress = subjectProp?.Address?.strFullAddress ?? deal?.PropertyAddress ?? '';
  const addrObj = subjectProp?.Address ?? {};
  const propAddrLine1 = (
    [addrObj?.StreetNumber, addrObj?.StreetName, addrObj?.strStreetType]
      .filter((v) => v && String(v).trim() !== '')
      .join(' ')
  ) || propAddress.split(',')[0] || propAddress;
  const propAddrCity     = (addrObj?.City     && String(addrObj.City).trim())     || null;
  const propAddrProvince = (addrObj?.strProvince && String(addrObj.strProvince).trim()) || null;
  const propAddrLine2    = `${propAddrCity ?? 'City'}, ${propAddrProvince ?? 'Province'}`;
  const propAddrPostal   = [addrObj?.PostalFsa, addrObj?.PostalLdu].filter((v) => v && String(v).trim()).join('') || null;
  const propAddrCountry  = (addrObj?.strCountryType && String(addrObj.strCountryType).trim()) || null;
  const propAddrExtra    = [propAddrPostal, propAddrCountry].filter(Boolean).join(', ') || null;
  const propValue   = fmt(subjectProp?.EstimatedValue ?? subjectProp?.PropertyValue, 'currency');
  const origValue   = fmt(subjectProp?.OriginalValue,  'currency');
  const purchaseDate= fmt(subjectProp?.PurchaseDate,   'date');
  const annualTaxes = fmt(subjectProp?.AnnualTaxes,    'currency');
  const dwellingType= [subjectProp?.strDwellingType, subjectProp?.strDwellingStyle].filter(Boolean).join(' — ') || '—';
  const propType    = subjectProp?.strPropertyType  ?? '—';
  const occupancy   = subjectProp?.strOccupancyType ?? '—';
  const livingSpace = subjectProp?.LivingSpace
    ? `${Number(subjectProp.LivingSpace).toLocaleString()} ${subjectProp?.strLivingSpaceUnitOfMeasure ?? 'sq ft'}`
    : '—';
  const numUnits    = subjectProp?.NumberOfUnits ? String(subjectProp.NumberOfUnits) : null;
  const garage      = [subjectProp?.strGarageType, subjectProp?.strGarageSize]
    .filter((v) => v && v !== '').join(' — ') || null;
  const closingDate = fmt(propMort?.ClosingDate, 'date');

  // Broker / agent
  const bOContact  = dealOwnerContact?.ContactName;
  const brokerName = bOContact
    ? [bOContact.FirstName, bOContact.LastName].filter(Boolean).join(' ')
    : deal?.BrokerName ?? null;
  const brokerPhone  = dealOwnerContact?.ContactPhones?.[0]?.PhoneNumber ?? null;
  const brokerEmail  = dealOwnerContact?.ContactEmailAddress ?? agentOnDeal?.NotificationEmailAddress ?? null;
  const brokerLicense= agentOnDeal?.LicenseNumber ?? null;
  const brokerBranch = agentOnDeal?.BranchName    ?? null;

  // Group financials
  const totalIncome = fmt(finGroup?.TotalIncome,      'currency');
  const totalAssets = fmt(finGroup?.TotalAssets,      'currency');
  const totalLiab   = fmt(finGroup?.TotalLiabilities, 'currency');
  const netWorth    = fmt(finGroup?.NetWorth,         'currency');
  const downPayment = fmt(reqMort?.DownPaymentAmount ?? reqMort?.DownPayment ?? dealObj?.DownPaymentAmount, 'currency');

  // ── Change history / activities ──────────────────────────────────────────────
  const changeHistory: any[] = (
    raw?.MortgageApplication?.ChangeHistory ??
    raw?.ChangeHistory ??
    raw?.MortgageApplication?.ActivityHistory ??
    []
  );

  // ── Documents / files ─────────────────────────────────────────────────────────
  const documents: any[] = (
    raw?.Documents ??
    raw?.MortgageApplication?.Documents ??
    raw?.MortgageApplication?.Attachments ??
    []
  );

  // ── Commissions & Fees (from raw.Commissions) ───────────────────────────────
  const commissions  = raw?.Commissions ?? {};
  const commMortList : any[] = commissions?.CommissionMortgagesLst ?? [];
  const commData     = commMortList[0]?.MortgageCommissionsData ?? {};
  const mortgageFees : any[] = commData?.MortgageFeesLst ?? [];
  const commSplits   : any[] = commData?.CommissionDetails?.SplitsList ?? [];
  const commDeductions: any[] = commData?.DeductionsLst ?? [];

  // DownPayment sources from MortgageDeal
  const downpaymentSources: any[] = dealObj?.DownpaymentSources ?? [];
  const totalDownPayment = downpaymentSources.reduce((sum: number, s: any) => sum + (Number(s?.Amount) || 0), 0);
  const depositAmount = totalDownPayment > 0 ? fmt(totalDownPayment, 'currency') : downPayment;

  // Brokerage fee (from commissions mortgage fees list)
  const brokerageFeeItem = mortgageFees.find((f: any) => f?.Description === 'Brokerage Fee' || f?.CommissionFeeTypeDD === 10);
  const findersFeeItem   = mortgageFees.find((f: any) => f?.Description === 'Finders Fee' || f?.CommissionFeeTypeDD === 11);
  const brokerageFeeAmt  = fmt(brokerageFeeItem?.Amount, 'currency');
  const brokerageFeeReceived = brokerageFeeItem?.FundsReceived;
  const findersFeeAmt    = fmt(findersFeeItem?.Amount, 'currency');
  const findersBP        = findersFeeItem?.BasisPoints != null ? `${Number(findersFeeItem.BasisPoints).toFixed(2)} bps` : null;

  // Commission totals
  const commTotalFees    = fmt(commData?.TotalFees, 'currency');
  const commTotalNetFees = fmt(commData?.TotalNetFees, 'currency');
  const commTotalDeductions = fmt(commData?.TotalDeductions, 'currency');
  const commNotes        = commData?.Notes ?? null;
  const commMaxFundsDate = fmt(commData?.MaxFundsReceivedDate, 'date');

  // Firm vs Agent splits
  const firmSplit  = commSplits.find((s: any) => s?.PayeeFirmFlag === true);
  const agentSplit = commSplits.find((s: any) => s?.PayeeAgentOnDealFlag === true);

  // Fee items from mortgage (Appraisal, Legal Fees, Lender Fee etc)
  const reqMortFeeItems: any[] = reqMort?.Fees?.FeeItems ?? [];
  const lenderFeeItem  = reqMortFeeItems.find((f: any) => f?.FeeType === 'Lender Fee');
  const appraisalFee   = reqMortFeeItems.find((f: any) => f?.FeeType === 'Appraisal');
  const legalFee       = reqMortFeeItems.find((f: any) => /Legal/i.test(f?.FeeType ?? ''));
  const brokerageFeeOnMortgage = reqMortFeeItems.find((f: any) => f?.FeeType === 'Brokerage Fee');

  // Compliance status derived from stage
  const complianceStatus = (() => {
    const closedStages = ['Closed / Funded', 'Paid & Finalized', 'Renewed'];
    const approvedStages = ['Approved', 'Ready to Close', ...closedStages];
    if (closedStages.includes(stage)) return 'Complete';
    if (approvedStages.includes(stage)) return 'Approved';
    if (stage === 'Compliance Review') return 'In Review';
    return 'Pending';
  })();
  const complianceBadgeCls = complianceStatus === 'Complete' ? 'bg-soft-success text-success border-success'
    : complianceStatus === 'Approved' ? 'bg-soft-info text-info border-info'
    : complianceStatus === 'In Review' ? 'bg-soft-primary text-primary border-primary'
    : 'bg-soft-warning text-warning border-warning';
  // Selected applicant (for left-sidebar applicant+property dropdowns)
  const clampedIdx   = allApplicants.length > 0 ? Math.min(selectedApplicantIdx, allApplicants.length - 1) : 0;
  const selApplicant = allApplicants[clampedIdx] ?? null;
  const selApplicantName = selApplicant
    ? [selApplicant.FirstName, selApplicant.LastName].filter(Boolean).join(' ') || `Applicant ${clampedIdx + 1}`
    : '';

  // Pipeline bar logic
  const pipelineIdx = PIPELINE_STAGES.findIndex((s) => s.key === stage);
  const isTerminal  = stage in TERMINAL_MAP;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content d-flex align-items-center justify-content-center" style={{ minHeight: 300 }}>
          <span className="badge rounded-pill bg-info fs-13">
            <i className="ti ti-loader-2 me-1" />Loading deal…
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content pb-0">
          <PageHeader title="Deals" badgeCount={0} showModuleTile={false} showExport={true} />

          <div className="row">
            <div className="col-md-12">
              <div className="mb-3">
                <Link href={all_routes.dealsGrid}>
                  <i className="ti ti-arrow-narrow-left me-1" />Back to Deals
                </Link>
              </div>

              {/* ── Header card ───────────────────────────────────────────── */}
              <div className="card mb-3">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    {/* Left: avatar + name + key info */}
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="avatar avatar-xxl avatar-rounded border border-warning bg-soft-warning flex-shrink-0"
                        style={{ width: 60, height: 60 }}
                      >
                        <h6 className="mb-0 text-warning">{initials}</h6>
                      </div>
                      <div>
                        <h5 className="mb-2">{dealName}</h5>
                        <div className="d-flex flex-wrap gap-4">
                          {/* Deal ID + Address */}
                          <div>
                            <div className="mb-1">
                              <span className="text-muted fs-12">Deal ID:&nbsp;</span>
                              <span className="text-muted fs-12">{deal?.key ?? appNumber ?? '—'}</span>
                            </div>
                            {propAddress && (
                              <div className="d-flex flex-column">
                                <span className="text-muted fs-12">
                                  <span>Address:&nbsp;</span>
                                  {propAddrLine1}
                                  {(propAddrCity || propAddrProvince) && (
                                    <>
                                      {propAddrLine1 ? ', ' : ''}
                                      <span className={!propAddrCity ? 'fst-italic opacity-50' : ''}>
                                        {propAddrCity ?? 'City'}
                                      </span>
                                      {', '}
                                      <span className={!propAddrProvince ? 'fst-italic opacity-50' : ''}>
                                        {propAddrProvince ?? 'Province'}
                                      </span>
                                    </>
                                  )}
                                </span>
                                {propAddrExtra && (
                                  <span className="text-muted fs-12 opacity-75">{propAddrExtra}</span>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Loan Amount + Closing Date */}
                          <div className="ms-5">
                            <div className="mb-1">
                              <span className="text-muted fs-12">Loan Amount:&nbsp;</span>
                              <span className="text-muted fs-12">
                                {loanAmt !== '—' ? (loanAmt.startsWith('$') ? loanAmt : `$${loanAmt}`) : '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted fs-12">Closing Date:&nbsp;</span>
                              <span className="text-muted fs-12">
                                {closingDate !== '—' ? closingDate : fmt(deal?.ExpectedCloseDate, 'date')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Right: Application Purpose + Type */}
                    {(purpose || appType) && (
                      <div className="d-flex flex-column gap-1" style={{ minWidth: 0 }}>
                        {purpose && (
                          <div className="d-flex align-items-center gap-2">
                            <span className="text-muted fs-12 flex-shrink-0" style={{ width: 140 }}>Application Purpose:</span>
                            <span className="text-muted fs-12">{purpose}</span>
                          </div>
                        )}
                        {appType && (
                          <div className="d-flex align-items-center gap-2">
                            <span className="text-muted fs-12 flex-shrink-0" style={{ width: 140 }}>Application Type:</span>
                            <span className="text-muted fs-12">{appType}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
            <div className="col-xl-4">

              {/* ── 1. APPLICANTS ────────────────────────────────────────────── */}
              {allApplicants.length > 0 && (
                <div className="card mb-3">
                  <div className="card-body p-3">
                    <SectionHead icon="ti-user-circle" title="Applicants" />
                    {allApplicants.length > 1 && (
                      <select
                        className="form-select form-select-sm mb-3"
                        value={clampedIdx}
                        onChange={(e) => setSelectedApplicantIdx(Number(e.target.value))}
                      >
                        {allApplicants.map((a: any, i: number) => {
                          const nm = [a?.FirstName, a?.LastName].filter(Boolean).join(' ') || `Applicant ${i + 1}`;
                          return <option key={i} value={i}>{nm}{a?.PrimaryFlag ? ' (Primary)' : ''}</option>;
                        })}
                      </select>
                    )}
                    {selApplicant && (() => {
                      const rawPhone = selApplicant.CellPhone ?? selApplicant.HomePhone ?? selApplicant.WorkPhone ?? '';
                      const digits   = String(rawPhone).replace(/\D/g, '');
                      const phone    = digits.length === 10
                        ? `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
                        : digits.length === 11 && digits[0] === '1'
                        ? `${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`
                        : rawPhone || '—';
                      const gender   = selApplicant.strGender ?? selApplicant.Gender ?? null;
                      const married  = selApplicant.strMaritalStatus
                        ? (/married/i.test(selApplicant.strMaritalStatus) ? 'Yes' : 'No')
                        : null;
                      const credit   = selApplicant.CreditScore != null ? String(selApplicant.CreditScore) : null;
                      const fields = [
                        { label: 'Applicant Name', value: selApplicantName || '—' },
                        { label: 'Phone',          value: phone },
                        { label: 'E-Mail',         value: selApplicant.EmailAddress || '—' },
                        { label: 'Gender',         value: gender || '—' },
                        { label: 'Credit Score',   value: credit || '—' },
                        { label: 'Married',        value: married || '—' },
                      ];
                      return (
                        <div className="d-flex flex-column gap-2">
                          {fields.map(({ label, value }) => (
                            <div key={label} className="d-flex justify-content-between align-items-center">
                              <span className="text-muted fs-12">{label}</span>
                              <span className="fs-12 text-dark text-end" style={{ maxWidth: '60%', wordBreak: 'break-word' }}>{value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ── 2. KEY DETAILS ───────────────────────────────────────────── */}
              <div className="card mb-3">
                <div className="card-body p-3">
                  <SectionHead icon="ti-layout-list" title="Key Details" />
                  <InfoField label="Application Purpose" value={purpose || appType || '—'} />
                  <InfoField label="Total Income"        value={totalIncome} />
                  <InfoField label="Total Assets"        value={totalAssets} />
                  <InfoField label="Total Liabilities"   value={totalLiab} />
                  <InfoField label="Net Worth"           value={netWorth} />
                  <InfoField label="Total Down Payment"  value={downPayment} />
                  <div className="pt-2 border-top mt-2">
                    {[
                      { label: 'Loan To Value (LTV)', value: ltv, warnAt: 80 },
                      { label: 'GDS (Gross Debt Service)', value: gds, warnAt: 32 },
                      { label: 'TDS (Total Debt Service)', value: tds, warnAt: 44 },
                    ].map(({ label, value, warnAt }) => {
                      const num = parseFloat(value);
                      const ok  = isNaN(num) || num <= warnAt;
                      return (
                        <div key={label} className="mb-3">
                          <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted" style={{ fontSize: 12 }}>{label}</span>
                            <span className={`fw-bold fs-12 ${value !== '—' ? (ok ? 'text-success' : 'text-danger') : 'text-muted'}`}>
                              {value !== '—' ? value : '—'}
                            </span>
                          </div>
                          {value !== '—' && (
                            <div className="progress" style={{ height: 4 }}>
                              <div className={`progress-bar ${ok ? 'bg-success' : 'bg-danger'}`} style={{ width: `${Math.min(100, num)}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── 2. TEAM ROLES ────────────────────────────────────────────── */}
              <div className="card mb-3">
                <div className="card-body p-3">
                  <SectionHead icon="ti-users" title="Team Roles" />
                  {/* Agent(s) on Deal */}
                  <div className="mb-2">
                    <span className="text-muted d-block" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Agent On Deal
                    </span>
                    {brokerName ? (
                      <div className="d-flex align-items-center mt-1 gap-2">
                        <span
                          className="avatar avatar-xs rounded-circle bg-soft-warning flex-shrink-0"
                          style={{ width: 28, height: 28 }}
                        >
                          <span className="avatar-title text-warning fs-10 fw-bold">
                            {brokerName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                          </span>
                        </span>
                        <div>
                          <p className="mb-0 fw-medium fs-12">{brokerName}</p>
                          {brokerBranch && <small className="text-muted">{brokerBranch}</small>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted fst-italic fs-12">—</span>
                    )}
                  </div>
                  <div className="border-top pt-2 mt-1">
                    <InfoField label="Assigned To"   value={null} />
                    <InfoField label="Supervised By" value={null} />
                  </div>
                </div>
              </div>

              {/* ── 3. DEPOSIT & FEES ────────────────────────────────────────── */}
              <div className="card mb-3">
                <div className="card-body p-3">
                  <SectionHead icon="ti-cash" title="Deposit & Fees" />
                  <InfoField label="Deposit Amount" value={depositAmount} />
                  {downpaymentSources.length > 0 && (
                    <div className="mb-2">
                      {downpaymentSources.map((src: any, i: number) => (
                        <div key={i} className="d-flex justify-content-between fs-12 mb-1 ps-2">
                          <span className="text-muted">{src.strDownPaymentSourceType ?? 'Source'}{src.Description ? ` — ${src.Description}` : ''}</span>
                          <span className="fw-medium">{fmt(src.Amount, 'currency')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <InfoField label="Brokerage Fee" value={brokerageFeeAmt !== '—' ? brokerageFeeAmt : fmt(brokerageFeeOnMortgage?.Amount, 'currency')} />
                  {lenderFeeItem && <InfoField label="Lender Fee" value={fmt(lenderFeeItem.Amount, 'currency')} />}
                  {appraisalFee && <InfoField label="Appraisal Fee" value={fmt(appraisalFee.Amount, 'currency')} />}
                  {legalFee && <InfoField label="Legal Fees" value={fmt(legalFee.Amount, 'currency')} />}
                  {findersFeeAmt !== '—' && (
                    <InfoField label="Finders Fee" value={`${findersFeeAmt}${findersBP ? ` (${findersBP})` : ''}`} />
                  )}
                  <div className="border-top pt-2 mt-1">
                    <InfoField label="Brokerage Fee Received" value={brokerageFeeReceived != null ? (brokerageFeeReceived ? 'Yes' : 'No') : null} />
                    <InfoField label="Funds Received Date" value={commMaxFundsDate} />
                    {commNotes && (
                      <div className="mt-2 p-2 rounded bg-light">
                        <span className="text-muted fs-11 d-block mb-1">Commission Notes</span>
                        <span className="fs-12">{commNotes}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 5. SUBJECT PROPERTY (single section with applicant context) */}
              <div className="card mb-3">
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-semibold mb-0 d-flex align-items-center gap-1">
                      <i className="ti ti-home text-primary" />Subject Property
                    </h6>
                    {allApplicants.length > 1 && (
                      <select
                        className="form-select form-select-sm"
                        style={{ maxWidth: 130 }}
                        value={clampedIdx}
                        onChange={(e) => setSelectedApplicantIdx(Number(e.target.value))}
                      >
                        {allApplicants.map((a: any, i: number) => {
                          const nm = [a?.FirstName, a?.LastName].filter(Boolean).join(' ') || `Applicant ${i + 1}`;
                          return <option key={i} value={i}>{nm}</option>;
                        })}
                      </select>
                    )}
                  </div>
                  {propAddress && (
                    <div className="mb-2 p-2 rounded bg-light">
                      <div className="d-flex align-items-start gap-1">
                        <i className="ti ti-map-pin text-primary flex-shrink-0" style={{ fontSize: 12, marginTop: 2 }} />
                        <div className="d-flex flex-column">
                          <span className="fs-12 fw-medium">{propAddrLine1}</span>
                          <span className="fs-12 text-muted">
                            <span className={!propAddrCity ? 'fst-italic opacity-50' : ''}>
                              {propAddrCity ?? 'City'}
                            </span>
                            {', '}
                            <span className={!propAddrProvince ? 'fst-italic opacity-50' : ''}>
                              {propAddrProvince ?? 'Province'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <InfoRow label="Freehold"       value={propType} />
                  <InfoRow label="Occupancy"      value={occupancy} />
                  <InfoRow label="Dwelling"       value={dwellingType} />
                  <InfoRow label="Estimated Value" value={propValue} />
                  <InfoRow label="Original Value"  value={origValue} />
                  <InfoRow label="Purchase Date"   value={purchaseDate} />
                  <InfoRow label="Annual Taxes"    value={annualTaxes} />
                  <InfoRow label="Living Space"    value={livingSpace} />
                  <InfoRow label="Units"           value={numUnits} />
                  <InfoRow label="Garage"          value={garage} />
                  <InfoRow label="Closing Date"    value={closingDate} />
                </div>
              </div>

              {/* ── 6. COMPLIANCE & ACCOUNTING (tabbed card) ─────────────────── */}
              <div className="card mb-3">
                <div className="card-body p-2">
                  <ul className="nav nav-tabs nav-sm border-0 mb-3" role="tablist">
                    {(['compliance', 'accounting'] as const).map((tab) => (
                      <li key={tab} className="nav-item" role="presentation">
                        <button
                          className={`nav-link border-0 py-2 px-3 fs-12 fw-medium${activeLeftTab === tab ? ' active' : ''}`}
                          onClick={() => setActiveLeftTab(tab)}
                          type="button"
                        >
                          {tab === 'compliance' ? (
                            <><i className="ti ti-shield-check me-1" />Compliance</>
                          ) : (
                            <><i className="ti ti-calculator me-1" />Accounting</>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Compliance tab */}
                  {activeLeftTab === 'compliance' && (
                    <div className="px-1">
                      <InfoField
                        label="Compliance Status"
                        badge={
                          <span className={`badge ${complianceBadgeCls} border fs-10`}>{complianceStatus}</span>
                        }
                      />
                      <InfoField label="Stage" value={stage || null} />
                      <InfoField label="Mortgage Status" value={reqMort?.strMortgageStatus || null} />
                      <div className="border-top pt-2 mt-2">
                        <p className="text-muted fs-11 fw-semibold mb-2 text-uppercase">Compliance Checklist</p>
                        {[
                          { label: 'ID Verification',         auto: allApplicants.some((a: any) => (a?.Identifications ?? []).length > 0) },
                          { label: 'Income Documents',        auto: allApplicants.some((a: any) => (a?.EmploymentHistories ?? []).length > 0 && a?.TotalCurrentIncome > 0) },
                          { label: 'Down Payment Verification', auto: downpaymentSources.length > 0 },
                          { label: 'Credit Bureau Pulled',    auto: allApplicants.some((a: any) => a?.CreditScore != null) || commDeductions.some((d: any) => /credit bureau/i.test(d?.DeductionTypeStr ?? '')) },
                          { label: 'Title Insurance',         auto: ['Approved', 'Ready to Close', 'Closed / Funded', 'Paid & Finalized', 'Renewed'].includes(stage) },
                          { label: 'Commitment Letter Issued', auto: ['Approved', 'Ready to Close', 'Closed / Funded', 'Paid & Finalized', 'Renewed'].includes(stage) },
                        ].map(({ label, auto }) => (
                          <div key={label} className="d-flex align-items-center gap-2 mb-2">
                            <input type="checkbox" className="form-check-input flex-shrink-0" id={`chk_${label}`} checked={auto} readOnly />
                            <label htmlFor={`chk_${label}`} className={`fs-12 mb-0 ${auto ? 'text-success' : 'text-dark'}`}>{label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accounting tab */}
                  {activeLeftTab === 'accounting' && (
                    <div className="px-1">
                      <p className="text-muted fs-11 fw-semibold mb-2 text-uppercase">Brokerage Fees</p>
                      <InfoField label="Brokerage Fee" value={brokerageFeeAmt !== '—' ? brokerageFeeAmt : fmt(brokerageFeeOnMortgage?.Amount, 'currency')} />
                      <InfoField label="Brokerage Fee Received" value={brokerageFeeReceived != null ? (brokerageFeeReceived ? 'Yes' : 'No') : null} />
                      {findersFeeAmt !== '—' && <InfoField label="Finders Fee" value={`${findersFeeAmt}${findersBP ? ` (${findersBP})` : ''}`} />}
                      {lenderFeeItem && <InfoField label="Lender Fee" value={fmt(lenderFeeItem.Amount, 'currency')} />}

                      <div className="border-top pt-2 mt-2">
                        <p className="text-muted fs-11 fw-semibold mb-2 text-uppercase">Commission</p>
                        <InfoField label="Total Commission" value={commTotalFees} />
                        <InfoField label="Net Commission" value={commTotalNetFees} />
                        <InfoField label="Total Deductions" value={commTotalDeductions} />
                        <InfoField label="Funds Received Date" value={commMaxFundsDate} />
                        {commNotes && <InfoField label="Notes" value={commNotes} />}
                      </div>

                      {/* Commission Splits */}
                      {commSplits.length > 0 && (
                        <div className="border-top pt-2 mt-2">
                          <p className="text-muted fs-11 fw-semibold mb-2 text-uppercase">Commission Split</p>
                          {commSplits.map((s: any, i: number) => (
                            <div key={i} className="d-flex justify-content-between fs-12 mb-1">
                              <span className="text-muted">
                                {s.SplitDescription}{s.PayeeName ? ` — ${s.PayeeName}` : ''}
                                {s.Level1Split != null ? ` (${s.Level1Split}%)` : ''}
                              </span>
                              <span className="fw-medium">{fmt(s.Fees, 'currency')}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Deductions */}
                      {commDeductions.length > 0 && (
                        <div className="border-top pt-2 mt-2">
                          <p className="text-muted fs-11 fw-semibold mb-2 text-uppercase">Deductions</p>
                          {commDeductions.map((d: any, i: number) => (
                            <div key={i} className="d-flex justify-content-between fs-12 mb-1">
                              <span className="text-muted">{d.DeductionTypeStr ?? d.OtherDeductionName ?? 'Deduction'}</span>
                              <span className="fw-medium">{fmt(d.Amount, 'currency')}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="border-top pt-2 mt-2">
                        <InfoField
                          label="Compliance Status"
                          badge={
                            <span className={`badge ${complianceBadgeCls} border fs-10`}>{complianceStatus}</span>
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="card mb-3">
                  <div className="card-body p-3">
                    <SectionHead icon="ti-tag" title="Tags" />
                    <div className="d-flex flex-wrap gap-2">
                      {tags.map((tag: string, i: number) => (
                        <span
                          key={i}
                          className={`badge fw-medium ${
                            i % 3 === 0 ? 'badge-soft-success' : i % 3 === 1 ? 'badge-soft-warning' : 'badge-soft-info'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* /LEFT SIDEBAR */}

            {/* ── RIGHT CONTENT ─────────────────────────────────────────────── */}
            <div className="col-xl-8">

              {/* Pipeline bar */}
              <div className="mb-3 pb-3 border-bottom">
                <h5 className="mb-3">Pipeline Status</h5>
                <div className="d-flex flex-wrap gap-2">
                  {isTerminal ? (
                    <>
                      <span className="badge bg-light text-muted border px-3 py-2">
                        Application received
                      </span>
                      <span className={`badge ${TERMINAL_MAP[stage]?.cls ?? 'badge bg-danger'} px-3 py-2`}>
                        {stage}
                      </span>
                    </>
                  ) : (
                    PIPELINE_STAGES.map((ps, idx) => {
                      const isDone   = pipelineIdx > idx;
                      const isActive = pipelineIdx === idx;
                      return (
                        <div
                          key={ps.key}
                          className={`px-3 py-2 rounded border fs-12 fw-medium ${
                            isActive
                              ? `${ps.color} text-white border-0`
                              : isDone
                              ? 'bg-soft-success text-success border-success'
                              : 'bg-light text-muted'
                          }`}
                        >
                          {isDone && <i className="ti ti-check me-1" />}
                          {ps.key}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="card mb-3">
                <div className="card-body pb-0 pt-2 px-2">
                  <ul className="nav nav-tabs nav-bordered border-0 mb-0" role="tablist">
                    {[
                      { id: 'tab_activities', icon: 'ti-alarm-minus', label: 'Activities' },
                      { id: 'tab_notes',      icon: 'ti-notes',       label: 'Notes'      },
                      { id: 'tab_calls',      icon: 'ti-phone',       label: 'Calls'      },
                      { id: 'tab_files',      icon: 'ti-file',        label: 'Files'      },
                      { id: 'tab_email',      icon: 'ti-mail',        label: 'Email'      },
                    ].map(({ id, icon, label }, i) => (
                      <li key={id} className="nav-item" role="presentation">
                        <Link
                          href={`#${id}`}
                          data-bs-toggle="tab"
                          className={`nav-link border-3${i === 0 ? ' active' : ''}`}
                          role="tab"
                        >
                          <i className={`ti ${icon} me-1`} />{label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Tab content */}
              <div className="tab-content pt-0">

                {/* ── Activities tab ───────────────────────────────────────── */}
                <div className="tab-pane active show" id="tab_activities">
                  <div className="card">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h6 className="fw-semibold mb-0">Activities</h6>
                        <button className="btn btn-sm btn-outline-primary">
                          <i className="ti ti-plus me-1" />Add Activity
                        </button>
                      </div>
                      {changeHistory.length > 0 ? (
                        <div className="timeline-activity">
                          {changeHistory.map((item: any, idx: number) => {
                            const dateStr = fmt(
                              item?.WhenDate ?? item?.ChangeDate ?? item?.Date ?? item?.CreatedDate ?? item?.Timestamp,
                              'date'
                            );
                            const desc = (
                              item?.ChangeDescription ??
                              item?.Description ??
                              item?.Action ??
                              item?.EventDescription ??
                              (() => {
                                const field = item?.FieldName ?? item?.Field ?? '';
                                const oldV  = item?.OldValue ?? item?.From ?? '';
                                const newV  = item?.NewValue ?? item?.To ?? '';
                                if (field && (oldV || newV)) return `${field}: ${oldV || '—'} → ${newV || '—'}`;
                                return null;
                              })()
                            );
                            if (!desc) return null;
                            const user = item?.ChangedByName ?? item?.UserName ?? item?.AgentName ?? item?.CreatedBy ?? null;
                            return (
                              <div key={idx} className="d-flex gap-3 mb-3 pb-3 border-bottom">
                                <div
                                  className="flex-shrink-0 rounded-circle bg-soft-primary d-flex align-items-center justify-content-center"
                                  style={{ width: 36, height: 36 }}
                                >
                                  <i className="ti ti-activity text-primary" style={{ fontSize: 16 }} />
                                </div>
                                <div className="flex-grow-1">
                                  <p className="mb-1 fs-13 text-dark">{desc}</p>
                                  <div className="d-flex align-items-center gap-2">
                                    {user && <span className="text-muted fs-11">{user}</span>}
                                    {user && dateStr !== '—' && <span className="text-muted fs-11">·</span>}
                                    {dateStr !== '—' && <span className="text-muted fs-11">{dateStr}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-5">
                          <i className="ti ti-activity fs-48 text-muted opacity-50" />
                          <p className="text-muted mt-2 mb-0">No activities recorded for this deal.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Notes tab ────────────────────────────────────────────── */}
                <div className="tab-pane" id="tab_notes">
                  <div className="card">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h6 className="fw-semibold mb-0">Notes</h6>
                        <button className="btn btn-sm btn-outline-primary">
                          <i className="ti ti-plus me-1" />Add New
                        </button>
                      </div>
                      {Array.isArray(raw?.DealNotes) && raw.DealNotes.length > 0 ? (
                        (raw.DealNotes as any[]).map((note: any, ni: number) => {
                          const noteText = typeof note?.NoteText === 'string'
                            ? note.NoteText
                            : typeof note?.Content === 'string'
                            ? note.Content
                            : typeof note?.Text === 'string'
                            ? note.Text
                            : typeof note?.Note === 'string'
                            ? note.Note
                            : null;
                          if (!noteText) return null;
                          const author   = note?.CreatedByName ?? note?.Author ?? note?.AgentName ?? null;
                          const dateStr  = fmt(note?.CreatedDate ?? note?.Date ?? note?.NoteDate, 'date');
                          const initials = author
                            ? author.split(' ').map((w: string) => w[0] ?? '').join('').substring(0, 2).toUpperCase()
                            : 'N';
                          return (
                            <div key={ni} className="card border shadow-none mb-3">
                              <div className="card-body p-3">
                                <div className="d-flex align-items-start gap-2 mb-2">
                                  <span
                                    className="avatar avatar-xs rounded-circle bg-soft-secondary flex-shrink-0"
                                    style={{ width: 32, height: 32 }}
                                  >
                                    <span className="avatar-title text-secondary fw-bold fs-11">{initials}</span>
                                  </span>
                                  <div>
                                    {author && <p className="mb-0 fw-medium fs-12">{author}</p>}
                                    {dateStr !== '—' && <small className="text-muted fs-11">{dateStr}</small>}
                                  </div>
                                </div>
                                <p className="mb-0 fs-13 text-dark">{noteText}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-5">
                          <i className="ti ti-notes fs-48 text-muted opacity-50" />
                          <p className="text-muted mt-2 mb-0">No notes recorded for this deal.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Calls tab ────────────────────────────────────────────── */}
                <div className="tab-pane" id="tab_calls">
                  <div className="card">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h6 className="fw-semibold mb-0">Calls</h6>
                        <button className="btn btn-sm btn-outline-primary">
                          <i className="ti ti-plus me-1" />Add New
                        </button>
                      </div>
                      {(() => {
                        const calls: any[] = (
                          raw?.Calls ??
                          raw?.MortgageApplication?.Calls ??
                          raw?.CallLogs ??
                          []
                        );
                        if (calls.length === 0) {
                          return (
                            <div className="text-center py-5">
                              <i className="ti ti-phone-off fs-48 text-muted opacity-50" />
                              <p className="text-muted mt-2 mb-0">No calls logged for this deal.</p>
                            </div>
                          );
                        }
                        return calls.map((call: any, ci: number) => {
                          const callerName = call?.CallerName ?? call?.AgentName ?? call?.LoggedBy ?? call?.UserName ?? 'Unknown';
                          const callDate   = fmt(call?.CallDate ?? call?.Date ?? call?.LoggedDate, 'date');
                          const callTime   = call?.CallTime ?? call?.Time ?? null;
                          const callStatus = call?.strCallResult ?? call?.Status ?? call?.Outcome ?? null;
                          const callNotes  = typeof call?.Notes === 'string' ? call.Notes
                            : typeof call?.Description === 'string' ? call.Description
                            : null;
                          const statusCls  = callStatus === 'Busy' ? 'bg-soft-warning text-warning'
                            : callStatus === 'No Answer' ? 'bg-soft-danger text-danger'
                            : callStatus === 'Answered' ? 'bg-soft-success text-success'
                            : 'bg-soft-secondary text-secondary';
                          return (
                            <div key={ci} className="card border shadow-none mb-3">
                              <div className="card-body p-3">
                                <div className="d-flex align-items-start justify-content-between mb-1">
                                  <div>
                                    <span className="fw-medium fs-13">{callerName}</span>
                                    <span className="text-muted fs-12 ms-1">
                                      logged a call{callDate !== '—' ? ` on ${callDate}` : ''}{callTime ? `, ${callTime}` : ''}
                                    </span>
                                  </div>
                                  {callStatus && (
                                    <span className={`badge ${statusCls} fs-11`}>{callStatus}</span>
                                  )}
                                </div>
                                {callNotes && <p className="mb-0 fs-12 text-muted mt-1">{callNotes}</p>}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* ── Files tab ────────────────────────────────────────────── */}
                <div className="tab-pane" id="tab_files">
                  <div className="card">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div>
                          <h6 className="fw-semibold mb-0">Manage Documents</h6>
                          <p className="text-muted fs-12 mb-0">Send customizable quotes, proposals and contracts to close deals faster.</p>
                        </div>
                        <button className="btn btn-sm btn-danger">
                          Create Document
                        </button>
                      </div>
                      {documents.length > 0 ? (
                        documents.map((doc: any, di: number) => {
                          const docName = doc?.FileName ?? doc?.DocumentName ?? doc?.Name ?? doc?.Title ?? `Document ${di + 1}`;
                          const docType = doc?.DocumentType ?? doc?.Type ?? doc?.MimeType ?? null;
                          const docOwner= doc?.OwnerName ?? doc?.UploadedBy ?? doc?.AgentName ?? null;
                          const docDate = fmt(doc?.CreatedDate ?? doc?.UploadDate ?? doc?.Date, 'date');
                          const docSize = doc?.FileSize
                            ? (Number(doc.FileSize) > 1024
                              ? `${(Number(doc.FileSize) / 1024).toFixed(0)} KB`
                              : `${doc.FileSize} B`)
                            : null;
                          const docStatus = doc?.Status ?? doc?.strStatus ?? null;
                          const statusCls = docStatus === 'Sent' ? 'bg-soft-success text-success'
                            : docStatus === 'Draft' ? 'bg-soft-warning text-warning'
                            : docStatus === 'Signed' ? 'bg-soft-info text-info'
                            : 'bg-soft-secondary text-secondary';
                          return (
                            <div key={di} className="card border shadow-none mb-3">
                              <div className="card-body p-3">
                                <div className="d-flex align-items-center justify-content-between">
                                  <div className="d-flex align-items-center gap-2">
                                    <div
                                      className="flex-shrink-0 rounded bg-soft-success d-flex align-items-center justify-content-center"
                                      style={{ width: 36, height: 36 }}
                                    >
                                      <i className="ti ti-file-text text-success" style={{ fontSize: 18 }} />
                                    </div>
                                    <div>
                                      <p className="mb-0 fw-medium fs-13">{docName}</p>
                                      <div className="d-flex align-items-center gap-2">
                                        {docOwner && (
                                          <span className="fs-11 text-muted">{docOwner} <span className="badge bg-soft-secondary text-secondary fs-10">Owner</span></span>
                                        )}
                                        {docSize && <span className="fs-11 text-muted">{docSize}</span>}
                                        {docDate !== '—' && <span className="fs-11 text-muted">{docDate}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="d-flex align-items-center gap-2">
                                    {docType && <span className="badge bg-soft-info text-info fs-10">{docType}</span>}
                                    {docStatus && <span className={`badge ${statusCls} fs-10`}>{docStatus}</span>}
                                    <button className="btn btn-link btn-sm text-muted p-0">
                                      <i className="ti ti-dots-vertical" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-5">
                          <i className="ti ti-files fs-48 text-muted opacity-50" />
                          <p className="text-muted mt-2 mb-1">No documents attached to this deal.</p>
                          <p className="text-muted fs-12">Use the button above to create a proposal, quote, or contract.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Email tab ────────────────────────────────────────────── */}
                <div className="tab-pane" id="tab_email">
                  <div className="card">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h6 className="fw-semibold mb-0">Email</h6>
                        <button className="btn btn-sm btn-outline-primary">
                          <i className="ti ti-plus me-1" />Create Email
                        </button>
                      </div>
                      <div className="card border shadow-none">
                        <div className="card-body p-4">
                          <div className="d-flex align-items-center justify-content-between">
                            <div>
                              <h6 className="fw-semibold mb-1">Manage Emails</h6>
                              <p className="text-muted fs-13 mb-0">You can send and reply to emails directly via this section.</p>
                            </div>
                            <button className="btn btn-danger btn-sm">
                              Connect Account
                            </button>
                          </div>
                        </div>
                      </div>
                      {deal?.Email && (
                        <div className="mt-3 p-3 rounded bg-light d-flex align-items-center gap-2">
                          <i className="ti ti-mail text-primary" style={{ fontSize: 18 }} />
                          <div>
                            <p className="mb-0 fw-medium fs-13">Primary contact email</p>
                            <a href={`mailto:${deal.Email}`} className="text-primary fs-12">{deal.Email}</a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
              {/* /Tab content */}
            </div>
            {/* /RIGHT CONTENT */}
          </div>
        </div>
        {/* End Content */}
        <Footer />
      </div>
      <ModalDealsDetails />
    </>
  );
}

export default DealsDetailsComponent;
