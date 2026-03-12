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
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
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
                            <div className="d-flex align-items-center gap-1 mb-1">
                              <i className="ti ti-hash text-primary" style={{ fontSize: 13 }} />
                              <span className="fw-semibold text-dark fs-13">{deal?.key ?? appNumber ?? '—'}</span>
                            </div>
                            {propAddress && (
                              <div className="d-flex align-items-start gap-1">
                                <i className="ti ti-map-pin text-muted mt-1" style={{ fontSize: 12 }} />
                                <span className="text-muted fs-12" style={{ maxWidth: 300 }}>{propAddress}</span>
                              </div>
                            )}
                          </div>
                          {/* Loan Amount + Closing Date */}
                          <div>
                            <div className="d-flex align-items-center gap-1 mb-1">
                              <i className="ti ti-coin text-success" style={{ fontSize: 13 }} />
                              <span className="fw-semibold text-dark fs-13">{loanAmt !== '—' ? loanAmt : '$—'}</span>
                            </div>
                            <div className="d-flex align-items-center gap-1">
                              <i className="ti ti-calendar text-muted" style={{ fontSize: 12 }} />
                              <span className="text-muted fs-12">
                                Closing: {closingDate !== '—' ? closingDate : fmt(deal?.ExpectedCloseDate, 'date')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {isTerminal ? (
                        <span className={TERMINAL_MAP[stage].cls}>{TERMINAL_MAP[stage].label}</span>
                      ) : (
                        <span className={`badge ${status === 'Open' ? 'bg-success' : 'bg-danger'}`}>{status}</span>
                      )}
                      {appStatus && (
                        <span className="badge bg-soft-primary text-primary border border-primary fs-11">{appStatus}</span>
                      )}
                      {purpose && appType && (
                        <span className="badge bg-soft-info text-info border border-info fs-11">
                          {purpose} — {appType}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
            <div className="col-xl-4">

              {/* ── 1. KEY DETAILS ───────────────────────────────────────────── */}
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
                  <InfoField label="Deposit Amount Required" value={downPayment} />
                  <InfoField label="Deposit Received On"    value={null} />
                  <InfoField label="Brokerage Fee"          value={null} />
                  <div className="border-top pt-2 mt-1">
                    <InfoField label="Letter of Direction Signed"           value={null} />
                    <InfoField label="Letter of Direction Sent to Lawyer"   value={null} />
                    <InfoField label="Confirmation From Lawyer"             value={null} />
                    <InfoField label="  └ Received On"                      value={null} />
                    <InfoField label="Brokerage Fee Received"               value={null} />
                    <InfoField label="  └ Received On"                      value={null} />
                  </div>
                </div>
              </div>

              {/* ── 4. APPLICANTS (dropdown) ─────────────────────────────────── */}
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
                      const emp  = (selApplicant.EmploymentHistories ?? [])[0] ?? {};
                      const dob  = fmt(selApplicant.DateOfBirth, 'date');
                      return (
                        <>
                          <div className="d-flex align-items-center mb-3 gap-2">
                            <span className="avatar avatar-sm rounded-circle bg-soft-primary flex-shrink-0" style={{ width: 36, height: 36 }}>
                              <span className="avatar-title text-primary fw-bold fs-12">
                                {selApplicantName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                              </span>
                            </span>
                            <div>
                              <h6 className="mb-0 fs-13 fw-semibold">{selApplicantName}</h6>
                              {selApplicant.PrimaryFlag && <span className="badge bg-success fs-10">Primary</span>}
                            </div>
                          </div>
                          {selApplicant.EmailAddress && (
                            <div className="d-flex align-items-center gap-1 mb-1">
                              <i className="ti ti-mail text-primary" style={{ fontSize: 12 }} />
                              <span className="fs-12">{selApplicant.EmailAddress}</span>
                            </div>
                          )}
                          {selApplicant.CellPhone && (
                            <div className="d-flex align-items-center gap-1 mb-1">
                              <i className="ti ti-device-mobile text-primary" style={{ fontSize: 12 }} />
                              <span className="fs-12">{selApplicant.CellPhone}</span>
                            </div>
                          )}
                          {dob !== '—' && (
                            <div className="d-flex align-items-center gap-1 mb-1">
                              <i className="ti ti-cake text-muted" style={{ fontSize: 12 }} />
                              <span className="fs-12 text-muted">DOB: {dob}</span>
                            </div>
                          )}
                          {selApplicant.strMaritalStatus && (
                            <div className="d-flex align-items-center gap-1 mb-1">
                              <i className="ti ti-heart text-muted" style={{ fontSize: 12 }} />
                              <span className="fs-12 text-muted">{selApplicant.strMaritalStatus}</span>
                            </div>
                          )}
                          {emp.EmployerName && (
                            <div className="d-flex align-items-center gap-1 mb-1">
                              <i className="ti ti-building text-muted" style={{ fontSize: 12 }} />
                              <span className="fs-12 text-muted">{emp.EmployerName}{emp.strOccupation ? ` — ${emp.strOccupation}` : ''}</span>
                            </div>
                          )}
                          <div className="row g-2 mt-1 border-top pt-2">
                            {[
                              { label: 'Total Assets',      value: fmt(selApplicant.TotalAssets,      'currency') },
                              { label: 'Total Liabilities', value: fmt(selApplicant.TotalLiabilities, 'currency') },
                            ].filter(({ value }) => value !== '—').map(({ label, value }) => (
                              <div key={label} className="col-6">
                                <p className="text-muted fs-11 mb-0">{label}</p>
                                <p className="fw-semibold fs-12 mb-0">{value}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

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
                      <i className="ti ti-map-pin text-primary me-1" style={{ fontSize: 12 }} />
                      <span className="fs-12 fw-medium">{propAddress}</span>
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
                          <span className="badge bg-soft-warning text-warning border border-warning fs-10">Pending</span>
                        }
                      />
                      <InfoField label="Completed By" value={null} />
                      <InfoField label="Completed On" value={null} />
                      <div className="border-top pt-2 mt-2">
                        <p className="text-muted fs-11 fw-semibold mb-2 text-uppercase">Compliance Checklist</p>
                        {[
                          'ID Verification',
                          'Income Documents',
                          'Down Payment Verification',
                          'Credit Bureau Pulled',
                          'Title Insurance',
                          'Commitment Letter Issued',
                        ].map((item) => (
                          <div key={item} className="d-flex align-items-center gap-2 mb-2">
                            <input type="checkbox" className="form-check-input flex-shrink-0" id={`chk_${item}`} />
                            <label htmlFor={`chk_${item}`} className="fs-12 text-dark mb-0">{item}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accounting tab */}
                  {activeLeftTab === 'accounting' && (
                    <div className="px-1">
                      <p className="text-muted fs-11 fw-semibold mb-2 text-uppercase">Brokerage</p>
                      <InfoField label="Brokerage Fee"          value={null} />
                      <InfoField label="Brokerage Fee Received" value={null} />
                      <InfoField label="Brokerage Fee Received On" value={null} />
                      <div className="border-top pt-2 mt-2">
                        <p className="text-muted fs-11 fw-semibold mb-2 text-uppercase">Commission</p>
                        <InfoField label="Commission Amount"    value={null} />
                        <InfoField label="Commission Received"  value={null} />
                        <InfoField label="Commission Received On" value={null} />
                      </div>
                      <div className="border-top pt-2 mt-2">
                        <InfoField
                          label="Compliance Status"
                          badge={
                            <span className="badge bg-soft-warning text-warning border border-warning fs-10">Pending</span>
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
                      { id: 'tab_overview',    icon: 'ti-layout-dashboard', label: 'Overview'   },
                      { id: 'tab_activities',  icon: 'ti-alarm-minus',      label: 'Activities' },
                      { id: 'tab_notes',       icon: 'ti-notes',            label: 'Notes'      },
                      { id: 'tab_calls',       icon: 'ti-phone',            label: 'Calls'      },
                      { id: 'tab_compliance',  icon: 'ti-shield-check',     label: 'Compliance' },
                      { id: 'tab_accounting',  icon: 'ti-calculator',       label: 'Accounting' },
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

                {/* ── Overview tab ─────────────────────────────────────────── */}
                <div className="tab-pane active show" id="tab_overview">

                  {/* Applicants */}
                  <h6 className="fw-semibold mb-3">
                    <i className="ti ti-users me-1 text-primary" />
                    Applicants ({allApplicants.length})
                  </h6>

                  {allApplicants.length === 0 && (
                    <div className="alert alert-info">No applicant data found in this record.</div>
                  )}

                  <div className="row g-3 mb-4">
                    {allApplicants.map((a: any, i: number) => {
                      const name     = [a?.FirstName, a?.LastName].filter(Boolean).join(' ');
                      const initAp   = name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
                      const dob      = fmt(a?.DateOfBirth, 'date');
                      const emp      = (a?.EmploymentHistories ?? [])[0] ?? {};
                      const assets: any[]      = a?.Assets ?? [];
                      const liabilities: any[] = a?.Liabilities ?? [];
                      const colorVariant       = i === 0 ? 'primary' : 'warning';
                      return (
                        <div key={i} className="col-md-6">
                          <div className="card h-100 border">
                            <div className="card-body p-3">

                              {/* Applicant header */}
                              <div className="d-flex align-items-center mb-3 gap-2">
                                <span
                                  className={`avatar avatar-md rounded-circle bg-soft-${colorVariant} flex-shrink-0`}
                                  style={{ width: 40, height: 40 }}
                                >
                                  <span className={`avatar-title text-${colorVariant} fw-bold`}>{initAp}</span>
                                </span>
                                <div>
                                  <h6 className="mb-0 fs-13 fw-semibold">{name || '—'}</h6>
                                  {a?.PrimaryFlag && (
                                    <span className="badge bg-success fs-10">Primary</span>
                                  )}
                                </div>
                              </div>

                              {/* Contact */}
                              <div className="mb-3">
                                <p className="text-muted fs-11 fw-semibold mb-1 text-uppercase">Contact</p>
                                <div className="d-flex flex-column gap-1">
                                  {a?.EmailAddress && (
                                    <span className="fs-12">
                                      <i className="ti ti-mail text-primary me-1" />{a.EmailAddress}
                                    </span>
                                  )}
                                  {a?.CellPhone && (
                                    <span className="fs-12">
                                      <i className="ti ti-device-mobile text-primary me-1" />{a.CellPhone}
                                    </span>
                                  )}
                                  {a?.HomePhone && a.HomePhone !== a.CellPhone && (
                                    <span className="fs-12">
                                      <i className="ti ti-phone text-muted me-1" />{a.HomePhone} (home)
                                    </span>
                                  )}
                                  {a?.WorkPhone && (
                                    <span className="fs-12">
                                      <i className="ti ti-building me-1 text-muted" />{a.WorkPhone} (work)
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Personal */}
                              {(dob !== '—' || a?.strMaritalStatus) && (
                                <div className="mb-3">
                                  <p className="text-muted fs-11 fw-semibold mb-1 text-uppercase">Personal</p>
                                  <div className="d-flex flex-column gap-1">
                                    {dob !== '—' && (
                                      <span className="fs-12"><i className="ti ti-cake me-1 text-muted" />DOB: {dob}</span>
                                    )}
                                    {a?.strMaritalStatus && (
                                      <span className="fs-12"><i className="ti ti-heart me-1 text-muted" />{a.strMaritalStatus}</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Employment */}
                              {emp?.EmployerName && (
                                <div className="mb-3">
                                  <p className="text-muted fs-11 fw-semibold mb-1 text-uppercase">Employment</p>
                                  <div className="d-flex flex-column gap-1">
                                    <span className="fs-12"><i className="ti ti-building me-1 text-muted" />{emp.EmployerName}</span>
                                    {emp.strOccupation && (
                                      <span className="fs-12"><i className="ti ti-briefcase me-1 text-muted" />{emp.strOccupation}</span>
                                    )}
                                    {emp.strEmploymentHistoryStatus && (
                                      <span className="badge bg-soft-info text-info fs-10 align-self-start mt-1">
                                        {emp.strEmploymentHistoryStatus}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Assets */}
                              {assets.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-muted fs-11 fw-semibold mb-1 text-uppercase">
                                    Assets{a?.TotalAssets ? ` (${fmt(a.TotalAssets, 'currency')} total)` : ''}
                                  </p>
                                  <div className="d-flex flex-column gap-1">
                                    {assets.map((ast: any, ai: number) => (
                                      <div key={ai} className="d-flex justify-content-between">
                                        <span className="fs-12 text-muted">
                                          {ast.strAssetType ?? 'Asset'}
                                          {ast.AssetDescription ? ` (${ast.AssetDescription})` : ''}
                                        </span>
                                        <span className="fs-12 fw-medium">{fmt(ast.AssetValue, 'currency')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Liabilities */}
                              {liabilities.length > 0 && (
                                <div>
                                  <p className="text-muted fs-11 fw-semibold mb-1 text-uppercase">Liabilities</p>
                                  <div className="d-flex flex-column gap-1">
                                    {liabilities.map((lib: any, li: number) => (
                                      <div key={li} className="d-flex justify-content-between">
                                        <span className="fs-12 text-muted">{lib.strLiabilityType ?? 'Liability'}</span>
                                        <span className="fs-12 fw-medium">{fmt(lib.Balance ?? lib.Amount, 'currency')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Subject Property full detail */}
                  <h6 className="fw-semibold mb-3">
                    <i className="ti ti-home-2 me-1 text-primary" />Subject Property
                  </h6>
                  <div className="card mb-4 border">
                    <div className="card-body p-3">
                      <div className="row g-2">
                        {[
                          { label: 'Full Address',    value: propAddress },
                          { label: 'Dwelling',        value: dwellingType },
                          { label: 'Property Type',   value: propType },
                          { label: 'Occupancy',       value: occupancy },
                          { label: 'Estimated Value', value: propValue },
                          { label: 'Original Value',  value: origValue },
                          { label: 'Purchase Date',   value: purchaseDate },
                          { label: 'Annual Taxes',    value: annualTaxes },
                          { label: 'Living Space',    value: livingSpace },
                          { label: 'Units',           value: numUnits ?? '—' },
                          { label: 'Garage',          value: garage ?? '—' },
                          { label: 'Closing Date',    value: closingDate },
                        ].filter(({ value }) => value && value !== '—').map(({ label, value }) => (
                          <div key={label} className="col-md-6">
                            <div className="d-flex justify-content-between py-1 border-bottom">
                              <span className="text-muted fs-12">{label}</span>
                              <span className="text-dark fw-medium fs-12 text-end" style={{ maxWidth: '60%' }}>{value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Existing mortgages on property */}
                  {Array.isArray(propMort?.ExistingMortgages) && propMort.ExistingMortgages.length > 0 && (
                    <>
                      <h6 className="fw-semibold mb-3">
                        <i className="ti ti-lock me-1 text-primary" />Existing Mortgages on Property
                      </h6>
                      <div className="card mb-4 border">
                        <div className="card-body p-3">
                          {(propMort.ExistingMortgages as any[]).map((em: any, ei: number) => (
                            <div key={ei} className={`row g-2 ${ei > 0 ? 'pt-2 mt-2 border-top' : ''}`}>
                              {[
                                { label: 'Lender',   value: em.strLenderName ?? em.LenderName },
                                { label: 'Balance',  value: fmt(em.Balance, 'currency') },
                                { label: 'Payment',  value: fmt(em.Payment, 'currency') },
                                { label: 'Rate',     value: em.InterestRate ? `${Number(em.InterestRate).toFixed(2)}%` : null },
                                { label: 'Type',     value: em.strMortgageType },
                                { label: 'Maturity', value: fmt(em.MaturityDate, 'date') },
                              ].filter(({ value }) => value && value !== '—').map(({ label, value }) => (
                                <div key={label} className="col-6">
                                  <span className="text-muted fs-11">{label}: </span>
                                  <span className="fw-medium fs-11">{value}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Financial Summary */}
                  {(totalIncome !== '—' || totalAssets !== '—') && (
                    <>
                      <h6 className="fw-semibold mb-3">
                        <i className="ti ti-receipt me-1 text-primary" />Group Financial Summary
                      </h6>
                      <div className="card mb-4 border">
                        <div className="card-body p-3">
                          <div className="row g-2 mb-3">
                            {[
                              { label: 'Total Income',      value: totalIncome, icon: 'ti-trending-up',   color: 'text-success' },
                              { label: 'Total Assets',      value: totalAssets, icon: 'ti-building-bank', color: 'text-primary' },
                              { label: 'Total Liabilities', value: totalLiab,   icon: 'ti-trending-down', color: 'text-danger'  },
                              { label: 'Net Worth',         value: netWorth,    icon: 'ti-star',          color: 'text-warning' },
                            ].filter(({ value }) => value !== '—').map(({ label, value, icon, color }) => (
                              <div key={label} className="col-md-3 col-6">
                                <div className="text-center p-2 rounded border">
                                  <i className={`ti ${icon} ${color} fs-20 mb-1`} />
                                  <p className="text-muted fs-11 mb-1">{label}</p>
                                  <h6 className="fw-bold mb-0 fs-13">{value}</h6>
                                </div>
                              </div>
                            ))}
                          </div>
                          {(ltv !== '—' || gds !== '—' || tds !== '—') && (
                            <div className="row g-3">
                              {[
                                { label: 'LTV', value: ltv, desc: 'Loan-to-Value',      warnAt: 80 },
                                { label: 'GDS', value: gds, desc: 'Gross Debt Service', warnAt: 32 },
                                { label: 'TDS', value: tds, desc: 'Total Debt Service', warnAt: 44 },
                              ].filter(({ value }) => value !== '—').map(({ label, value, desc, warnAt }) => {
                                const n = parseFloat(value); const ok = isNaN(n) || n <= warnAt;
                                return (
                                  <div key={label} className="col-md-4">
                                    <div className="d-flex justify-content-between mb-1">
                                      <span className="fs-12 text-muted">{label} <span className="fst-italic" style={{ fontSize: 10 }}>({desc})</span></span>
                                      <span className={`fs-12 fw-bold ${ok ? 'text-success' : 'text-danger'}`}>{value}</span>
                                    </div>
                                    <div className="progress" style={{ height: 5 }}>
                                      <div className={`progress-bar ${ok ? 'bg-success' : 'bg-danger'}`} style={{ width: `${Math.min(100, n)}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {/* /Overview tab */}

                {/* ── Activities tab ───────────────────────────────────────── */}
                <div className="tab-pane" id="tab_activities">
                  <div className="card">
                    <div className="card-body">
                      <p className="text-muted mb-0">Activity tracking will be integrated in a future update.</p>
                    </div>
                  </div>
                </div>

                {/* ── Notes tab ────────────────────────────────────────────── */}
                <div className="tab-pane" id="tab_notes">
                  <div className="card">
                    <div className="card-body">
                      {Array.isArray(raw?.DealNotes) && raw.DealNotes.length > 0 ? (
                        (raw.DealNotes as any[]).map((note: any, ni: number) => (
                          <div key={ni} className="card border shadow-none mb-2">
                            <div className="card-body p-3">
                              <p className="mb-1 fs-13">{note.NoteText ?? note.Content ?? JSON.stringify(note)}</p>
                              {note.CreatedDate && (
                                <small className="text-muted">{fmt(note.CreatedDate, 'date')}</small>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted mb-0">No notes recorded for this deal.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Calls tab ────────────────────────────────────────────── */}
                <div className="tab-pane" id="tab_calls">
                  <div className="card">
                    <div className="card-body">
                      <p className="text-muted mb-0">Call log integration coming soon.</p>
                    </div>
                  </div>
                </div>

                {/* ── Compliance tab ───────────────────────────────────────── */}
                <div className="tab-pane" id="tab_compliance">
                  <div className="card">
                    <div className="card-body">
                      <div className="row g-3 mb-4">
                        <div className="col-md-4">
                          <label className="form-label fs-12 text-muted">Compliance Status</label>
                          <select className="form-select form-select-sm">
                            {['Pending', 'In Progress', 'Completed', 'Issue Found', 'On Hold'].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label fs-12 text-muted">Completed By</label>
                          <input type="text" className="form-control form-control-sm" placeholder="—" />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label fs-12 text-muted">Completed On</label>
                          <input type="date" className="form-control form-control-sm" />
                        </div>
                      </div>
                      <div className="border-top pt-3">
                        <h6 className="fw-semibold mb-3"><i className="ti ti-checklist me-1 text-primary" />Compliance Checklist</h6>
                        <div className="row g-2">
                          {[
                            'ID Verification',
                            'Income Documents',
                            'Down Payment Verification',
                            'Credit Bureau Pulled',
                            'Title Insurance',
                            'Commitment Letter Issued',
                            'Signed Conditions',
                            'Lawyer Instructions Sent',
                          ].map((item) => (
                            <div key={item} className="col-md-6">
                              <div className="form-check">
                                <input className="form-check-input" type="checkbox" id={`rchk_${item.replace(/\s/g, '_')}`} />
                                <label className="form-check-label fs-13" htmlFor={`rchk_${item.replace(/\s/g, '_')}`}>{item}</label>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-muted fs-11 mt-3 mb-0">
                          <i className="ti ti-info-circle me-1" />Additional compliance items can be configured in Settings.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Accounting tab ───────────────────────────────────────── */}
                <div className="tab-pane" id="tab_accounting">
                  <div className="card">
                    <div className="card-body">
                      <div className="row g-4">
                        {/* Brokerage */}
                        <div className="col-md-6">
                          <h6 className="fw-semibold mb-3 text-primary fs-13 text-uppercase">
                            <i className="ti ti-building-bank me-1" />Brokerage
                          </h6>
                          <div className="mb-3">
                            <label className="form-label fs-12 text-muted">Brokerage Fee</label>
                            <input type="text" className="form-control form-control-sm" placeholder="$0.00" />
                          </div>
                          <div className="mb-3">
                            <label className="form-label fs-12 text-muted">Brokerage Fee Received</label>
                            <select className="form-select form-select-sm">
                              <option>No</option>
                              <option>Yes</option>
                            </select>
                          </div>
                          <div className="mb-3">
                            <label className="form-label fs-12 text-muted">Brokerage Fee Received On</label>
                            <input type="date" className="form-control form-control-sm" />
                          </div>
                        </div>
                        {/* Commission */}
                        <div className="col-md-6">
                          <h6 className="fw-semibold mb-3 text-success fs-13 text-uppercase">
                            <i className="ti ti-coin me-1" />Commission
                          </h6>
                          <div className="mb-3">
                            <label className="form-label fs-12 text-muted">Commission Amount</label>
                            <input type="text" className="form-control form-control-sm" placeholder="$0.00" />
                          </div>
                          <div className="mb-3">
                            <label className="form-label fs-12 text-muted">Commission Received</label>
                            <select className="form-select form-select-sm">
                              <option>No</option>
                              <option>Yes</option>
                            </select>
                          </div>
                          <div className="mb-3">
                            <label className="form-label fs-12 text-muted">Commission Received On</label>
                            <input type="date" className="form-control form-control-sm" />
                          </div>
                        </div>
                      </div>
                      <div className="border-top pt-3 mt-2">
                        <div className="row align-items-center">
                          <div className="col-md-4">
                            <label className="form-label fs-12 text-muted">Compliance Status</label>
                            <select className="form-select form-select-sm">
                              {['Pending', 'In Progress', 'Completed', 'Issue Found', 'On Hold'].map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
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
