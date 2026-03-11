"use client";
/* eslint-disable @next/next/no-img-element */
import Footer from "@/core/common/footer/footer"
import ImageWithBasePath from "@/core/common/imageWithBasePath"
import PageHeader from "@/core/common/page-header/pageHeader"
import { Assigned_To, Priority, Reminder, Task_Priority } from "../../../../core/json/selectOption"
import CommonSelect from "@/core/common/common-select/commonSelect"
import ModalDealsDetails from "./modal/modalDealsDetails"
import Link from "next/link"
import { all_routes } from "@/router/all_routes"
import { useState, useEffect } from "react"
import type { NormalizedScarlettDeal } from "@/core/types/scarlettDeal"

interface DealsDetailsProps {
  dealKey?: string;
}

const PIPELINE_STAGES = [
  { label: 'Qualify To Buy', key: 'qualify to buy', color: 'bg-indigo' },
  { label: 'Contact Made',   key: 'contact made',   color: 'bg-warning' },
  { label: 'Appraisal',      key: 'appraisal',      color: 'bg-orange' },
  { label: 'Underwriting',   key: 'underwriting',   color: 'bg-pink' },
  { label: 'Final Approval', key: 'final approval', color: 'bg-purple' },
  { label: 'Closed Won',     key: 'closed won',     color: 'bg-success' },
  { label: 'Lost',           key: 'lost',           color: 'bg-danger' },
];

const DealsDetailsComponent = ({ dealKey }: DealsDetailsProps) => {
  const [deal, setDeal] = useState<NormalizedScarlettDeal | null>(null);
  const [loading, setLoading] = useState(!!dealKey);

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

  // Derive display values from live deal (or fall back to demo values)
  const dealName  = deal?.DealName ?? 'Tremblay and Rath';
  const initials  = dealName.split(' ').map((w) => w[0] ?? '').join('').substring(0, 2).toUpperCase();
  const dealValue = deal?.DealValue ?? '$25,11,145';
  const probability = deal?.Probability ?? '80%';
  const closeDate   = deal?.ExpectedCloseDate ?? '27 Sep 2025';
  const stage       = deal?.Stage?.toLowerCase() ?? '';
  const status      = deal?.Status ?? 'Open';
  const tags        = deal ? (Array.isArray(deal.Tags) ? deal.Tags : [deal.Tags]).filter(Boolean) : ['Collab', 'VIP'];
  const email           = deal?.Email ?? '';
  const phone           = deal?.Phone ?? '';
  const propertyAddress = deal?.PropertyAddress ?? '';
  const mortgageType    = deal?.MortgageType ?? '';
  const loanAmount      = deal?.LoanAmount ?? '';
  const appNumber       = deal?.ApplicationNumber ?? '';
  const brokerName      = deal?.BrokerName ?? '';
  const applicants      = deal?.Applicants ?? [];

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
  {/* ========================
			Start Page Content
		========================= */}
  <div className="page-wrapper">
    {/* Start Content */}
    <div className="content pb-0">
      {/* Page Header */}
      <PageHeader
            title="Deals"
            badgeCount={125}
            showModuleTile={false}
            showExport={true}
          />
      {/* End Page Header */}
      <div className="row">
        <div className="col-md-12">
          <div className="mb-3">
            <Link href={all_routes.dealsGrid}>
              <i className="ti ti-arrow-narrow-left me-1" />
              Back to Deals
            </Link>
          </div>
          <div className="card">
            <div className="card-body pb-2">
              <div className="d-flex align-items-center justify-content-between flex-wrap">
                <div className="d-flex align-items-center mb-2">
                  <div className="avatar avatar-xxl avatar-rounded border border-warning bg-soft-warning me-3 flex-shrink-0">
                    <h6 className="mb-0 text-warning">{initials}</h6>
                  </div>
                  <div>
                    <h5 className="mb-1">
                      {dealName}{" "}
                      <i className="ti ti-star-filled text-warning" />
                    </h5>
                    {email && (
                      <p className="mb-1">
                        <i className="ti ti-mail me-1" />
                        {email}
                      </p>
                    )}
                    {phone && (
                      <p className="mb-1">
                        <i className="ti ti-phone me-1" />
                        {phone}
                      </p>
                    )}
                    <p className="mb-0">
                      <i className="ti ti-map-pin-pin me-1" />
                      {propertyAddress || 'Scarlett Network'}
                    </p>
                  </div>
                </div>
                <div className="d-flex align-items-center flex-wrap gap-2">
                  <span className="py-1 px-2 fs-12 bg-soft-danger rounded text-danger fw-medium">
                    <i className="ti ti-lock me-1" />
                    Private
                  </span>
                  <div className="dropdown">
                    <Link
                      href="#"
                      className={`btn btn-xs fs-12 py-1 px-2 fw-medium d-inline-flex align-items-center ${
                        status === 'Won' ? 'btn-success' : status === 'Lost' ? 'btn-danger' : 'btn-primary'
                      }`}
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      {" "}
                      <i className={`ti me-1 ${
                        status === 'Won' ? 'ti-thumb-up' : status === 'Lost' ? 'ti-thumb-down' : 'ti-circle'
                      }`} />
                      {status}
                      <i className="ti ti-chevron-down ms-1" />{" "}
                    </Link>
                    <div className="dropdown-menu dropdown-menu-right">
                      <Link className="dropdown-item" href="#">
                        <span>Won</span>
                      </Link>
                      <Link className="dropdown-item" href="#">
                        <span>Lost</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* /Contact User */}
        </div>
        {/* Contact Sidebar */}
        <div className="col-xl-4">
          <div className="card">
            <div className="card-body p-3">
              <h6 className="mb-3 fw-semibold">Deals Information</h6>
              <div className="border-bottom mb-3 pb-3">
                {appNumber && (
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <p className="mb-0">Application #</p>
                    <p className="mb-0 text-dark fw-medium">{appNumber}</p>
                  </div>
                )}
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <p className="mb-0">Probability - Win</p>
                  <p className="mb-0 text-dark">{probability}</p>
                </div>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <p className="mb-0">Property Value</p>
                  <p className="mb-0 text-dark">{dealValue}</p>
                </div>
                {loanAmount && (
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <p className="mb-0">Loan Amount</p>
                    <p className="mb-0 text-dark">{loanAmount}</p>
                  </div>
                )}
                {mortgageType && (
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <p className="mb-0">Mortgage Type</p>
                    <p className="mb-0 text-dark">{mortgageType}</p>
                  </div>
                )}
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <p className="mb-0">Expected Close</p>
                  <p className="mb-0 text-dark">{closeDate}</p>
                </div>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <p className="mb-0">Stage</p>
                  <p className="mb-0 text-dark">{deal?.Stage ?? 'N/A'}</p>
                </div>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <p className="mb-0">Status</p>
                  <span className={`badge ${
                    status === 'Won' ? 'bg-success' : status === 'Lost' ? 'bg-danger' : 'bg-purple'
                  }`}>{status}</span>
                </div>
                {propertyAddress && (
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <p className="mb-0">Property</p>
                    <p className="mb-0 text-dark text-end" style={{ maxWidth: '55%' }}>{propertyAddress}</p>
                  </div>
                )}
              </div>
              <div className="d-flex align-items-center justify-content-between flex-wrap">
                <h6 className="mb-3 fw-semibold">Deal Owner</h6>
                <Link
                  href="#"
                  className="link-primary mb-3"
                  data-bs-toggle="modal"
                  data-bs-target="#owner"
                >
                  <i className="ti ti-plus me-1" />
                  Add New
                </Link>
              </div>
              {applicants.length > 0 ? (
                <div className="border-bottom mb-3 pb-3">
                  {applicants.map((name, i) => (
                    <div key={i} className="d-flex align-items-center mb-2">
                      <span className="avatar avatar-xs rounded-circle me-2 bg-soft-primary">
                        <span className="avatar-title text-primary fs-10">{name.split(' ').map((w) => w[0]).join('').substring(0,2).toUpperCase()}</span>
                      </span>
                      <div>
                        <p className="mb-0">{name}</p>
                        {i === 0 && email && <small className="text-muted">{email}</small>}
                        {i === 0 && phone && <small className="text-muted d-block">{phone}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-bottom mb-3 pb-3">
                  <p className="text-muted mb-0">No applicants available</p>
                </div>
              )}
              <h6 className="mb-3 fw-semibold">Tags</h6>
              <div className="border-bottom mb-3 pb-3">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className={`badge fw-medium me-2 ${
                      i % 3 === 0 ? 'badge-soft-success' : i % 3 === 1 ? 'badge-soft-warning' : 'badge-soft-info'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h6 className="mb-3 fw-semibold">Priority</h6>
              <div className="border-bottom mb-3 pb-3">
                <CommonSelect
                    options={Priority}
                    className="select"
                    defaultValue={Priority[0]}
                    />
              </div>
              <h6 className="mb-3 fw-semibold">Projects</h6>
              <div className="d-flex align-items-center border-bottom mb-3 pb-3">
                <span className="badge bg-white text-body fw-medium border me-2">
                  Devops Design
                </span>
                <span className="badge bg-white text-body fw-medium border me-2">
                  Margrate Design
                </span>
              </div>
              {brokerName && (
                <>
                  <h6 className="mb-3 fw-semibold">Broker / Agent</h6>
                  <div className="border-bottom mb-3 pb-3">
                    <div className="d-flex align-items-center">
                      <span className="avatar avatar-xs rounded-circle me-2 bg-soft-warning">
                        <span className="avatar-title text-warning fs-10">{brokerName.split(' ').map((w:string) => w[0]).join('').substring(0,2).toUpperCase()}</span>
                      </span>
                      <div>
                        <p className="mb-0">{brokerName}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {/* /Contact Sidebar */}
        {/* Contact Details */}
        <div className="col-xl-8">
          <div className="mb-3 pb-3 border-bottom">
            <h5 className="mb-3">Deals Pipeline Status</h5>
            <div className="step-progress d-flex flex-wrap gap-2">
              {PIPELINE_STAGES.map((s) => {
                const isActive = stage && (s.key === stage || stage.includes(s.key) || s.key.includes(stage));
                return (
                  <div
                    key={s.key}
                    className={`step ${isActive ? s.color : 'bg-light text-muted border'}`}
                    style={isActive ? {} : { opacity: 0.55 }}
                  >
                    {s.label}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card mb-3">
            <div className="card-body pb-0 pt-2 px-2">
              <ul
                className="nav nav-tabs nav-bordered border-0 mb-0"
                role="tablist"
              >
                <li className="nav-item" role="presentation">
                  <Link
                    href="#tab_1"
                    data-bs-toggle="tab"
                    aria-expanded="false"
                    className="nav-link active border-3"
                    aria-selected="true"
                    role="tab"
                  >
                    <span className="d-md-inline-block">
                      <i className="ti ti-alarm-minus me-1" />
                      Activities
                    </span>
                  </Link>
                </li>
                <li className="nav-item" role="presentation">
                  <Link
                    href="#tab_2"
                    data-bs-toggle="tab"
                    aria-expanded="true"
                    className="nav-link border-3"
                    aria-selected="false"
                    role="tab"
                    tabIndex={-1}
                  >
                    <span className="d-md-inline-block">
                      <i className="ti ti-notes me-1" />
                      Notes
                    </span>
                  </Link>
                </li>
                <li className="nav-item" role="presentation">
                  <Link
                    href="#tab_3"
                    data-bs-toggle="tab"
                    aria-expanded="false"
                    className="nav-link border-3"
                    aria-selected="false"
                    tabIndex={-1}
                    role="tab"
                  >
                    <span className="d-md-inline-block">
                      <i className="ti ti-phone me-1" />
                      Calls
                    </span>
                  </Link>
                </li>
                <li className="nav-item" role="presentation">
                  <Link
                    href="#tab_4"
                    data-bs-toggle="tab"
                    aria-expanded="false"
                    className="nav-link border-3"
                    aria-selected="false"
                    tabIndex={-1}
                    role="tab"
                  >
                    <span className="d-md-inline-block">
                      <i className="ti ti-file me-1" />
                      Files
                    </span>
                  </Link>
                </li>
                <li className="nav-item" role="presentation">
                  <Link
                    href="#tab_5"
                    data-bs-toggle="tab"
                    aria-expanded="false"
                    className="nav-link border-3"
                    aria-selected="false"
                    tabIndex={-1}
                    role="tab"
                  >
                    <span className="d-md-inline-block">
                      <i className="ti ti-mail-check me-1" />
                      Email
                    </span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          {/* Tab Content */}
          <div className="tab-content pt-0">
            {/* Activities */}
            <div className="tab-pane active show" id="tab_1">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <h5 className="fw-semibold mb-0">Activities</h5>
                  <div className="dropdown">
                    <Link
                      href="#"
                      className="dropdown-toggle btn btn-outline-light px-2 shadow"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-sort-ascending-2 me-2" />
                      Sort By
                    </Link>
                    <div className="dropdown-menu">
                      <ul>
                        <li>
                          <Link
                            href="#"
                            className="dropdown-item"
                          >
                            Newest
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="#"
                            className="dropdown-item"
                          >
                            Oldest
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="badge badge-soft-info border-0 mb-3">
                    <i className="ti ti-calendar-check me-1" />
                    28 May 2025
                  </div>
                  <div className="card border shadow-none mb-3">
                    <div className="card-body p-3">
                      <div className="d-flex flex-wrap row-gap-2">
                        <span className="avatar avatar-md flex-shrink-0 rounded me-2 bg-info">
                          <i className="ti ti-mail-code fs-20" />
                        </span>
                        <div>
                          <h6 className="fw-medium fs-14 mb-1">
                            You sent 1 Message to the contact.
                          </h6>
                          <p className="mb-0">10:25 pm</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card border shadow-none mb-3">
                    <div className="card-body p-3">
                      <div className="d-flex flex-wrap row-gap-2">
                        <span className="avatar avatar-md flex-shrink-0 rounded me-2 bg-teal">
                          <i className="ti ti-phone fs-20" />
                        </span>
                        <div>
                          <h6 className="fw-medium fs-14 mb-1">
                            Denwar responded to your appointment schedule by
                            call at 09:30pm.
                          </h6>
                          <p className="mb-0">09:25 pm</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card border shadow-none mb-3">
                    <div className="card-body p-3">
                      <div className="d-flex align-items-center flex-lg-nowrap flex-wrap row-gap-2">
                        <span className="avatar avatar-md flex-shrink-0 rounded me-2 bg-danger">
                          <i className="ti ti-notes fs-20" />
                        </span>
                        <div>
                          <h6 className="fw-medium fs-14 mb-1">
                            Notes added by Antony
                          </h6>
                          <p className="mb-1">
                            Please accept my apologies for the inconvenience
                            caused. It would be much appreciated if it's
                            possible to reschedule to 6:00 PM, or any other day
                            that week.
                          </p>
                          <p className="mb-0">10.00 pm</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="badge badge-soft-info border-0 mb-3">
                    <i className="ti ti-calendar-check me-1" />
                    27 May 2025
                  </div>
                  <div className="card border shadow-none mb-3">
                    <div className="card-body p-3">
                      <div className="d-flex flex-wrap row-gap-2">
                        <span className="avatar avatar-md flex-shrink-0 rounded me-2 bg-warning">
                          <i className="ti ti-user-pin fs-20" />
                        </span>
                        <div>
                          <h6 className="fw-medium mb-1 d-inline-flex align-items-center fs-14 flex-wrap">
                            Meeting With{" "}
                            <span className="avatar avatar-xs rounded mx-2">
                              <ImageWithBasePath
                                src="assets/img/profiles/avatar-19.jpg"
                                alt="img"
                              />
                            </span>{" "}
                            Abraham
                          </h6>
                          <p className="mb-0">Schedueled on 05:00 pm</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card border shadow-none mb-3">
                    <div className="card-body p-3">
                      <div className="d-flex flex-wrap row-gap-2">
                        <span className="avatar avatar-md flex-shrink-0 rounded me-2 bg-teal">
                          <i className="ti ti-notes fs-20" />
                        </span>
                        <div>
                          <h6 className="fw-medium fs-14 mb-1">
                            Drain responded to your appointment schedule
                            question.
                          </h6>
                          <p className="mb-0">09:25 pm</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="badge badge-soft-info border-0 mb-3">
                    <i className="ti ti-calendar-check me-1" />
                    Upcoming Activity
                  </div>
                  <div className="card border shadow-none mb-0">
                    <div className="card-body p-3">
                      <div className="d-flex flex-lg-nowrap flex-wrap row-gap-2">
                        <span className="avatar avatar-md flex-shrink-0 rounded me-2 bg-warning">
                          <i className="ti ti-user-pin fs-20" />
                        </span>
                        <div>
                          <h6 className="fw-medium fs-14 mb-1">
                            Product Meeting
                          </h6>
                          <p className="mb-1">
                            A product team meeting is a gathering of the
                            cross-functional product team — ideally including
                            team members from product, engineering, marketing,
                            and customer support.
                          </p>
                          <p>25 Jul 2023, 05:00 pm</p>
                          <div className="card mb-0">
                            <div className="card-body">
                              <div className="row gy-3">
                                <div className="col-md-4">
                                  <div>
                                    <label className="form-label">
                                      Reminder{" "}
                                      <span className="text-danger">*</span>
                                    </label>
                                    <CommonSelect
                            options={Reminder}
                            className="select"
                            defaultValue={Reminder[0]}
                          />
                                  </div>
                                </div>
                                <div className="col-md-4">
                                  <div>
                                    <label className="form-label">
                                      Task Priority{" "}
                                      <span className="text-danger">*</span>
                                    </label>
                                     <CommonSelect
                            options={Task_Priority}
                            className="select"
                            defaultValue={Task_Priority[0]}
                          />
                                  </div>
                                </div>
                                <div className="col-md-4">
                                  <div>
                                    <label className="form-label">
                                      Assigned To{" "}
                                      <span className="text-danger">*</span>
                                    </label>
                                    <CommonSelect
                            options={Assigned_To}
                            className="select"
                            defaultValue={Assigned_To[0]}
                          />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Activities */}
            {/* Notes */}
            <div className="tab-pane fade" id="tab_2">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <h5 className="fw-semibold mb-0">Notes</h5>
                  <div className="d-inline-flex align-items-center">
                    <div className="dropdown me-2">
                      <Link
                        href="#"
                        className="dropdown-toggle btn btn-outline-light px-2 shadow"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-sort-ascending-2 me-2" />
                        Sort By
                      </Link>
                      <div className="dropdown-menu">
                        <ul>
                          <li>
                            <Link
                              href="#"
                              className="dropdown-item"
                            >
                              Newest
                            </Link>
                          </li>
                          <li>
                            <Link
                              href="#"
                              className="dropdown-item"
                            >
                              Oldest
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <Link
                      href="#"
                      data-bs-toggle="modal"
                      data-bs-target="#add_notes"
                      className="link-primary fw-medium"
                    >
                      <i className="ti ti-circle-plus me-1" />
                      Add New
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  <div className="notes-activity">
                    <div className="card mb-3">
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2 pb-2">
                          <div className="d-inline-flex align-items-center mb-2">
                            <span className="avatar avatar-md me-2 flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/profiles/avatar-19.jpg"
                                alt="img"
                              />
                            </span>
                            <div>
                              <h6 className="fw-medium fs-14 mb-1">
                                Darlee Robertson
                              </h6>
                              <p className="mb-0 fs-13">
                                15 Sep 2023, 12:10 pm
                              </p>
                            </div>
                          </div>
                          <div className="mb-2">
                            <div className="dropdown">
                              <Link
                                href="#"
                                className="action-icon btn btn-icon btn-sm btn-outline-light shadow"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                              >
                                <i className="ti ti-dots-vertical" />
                              </Link>
                              <div className="dropdown-menu dropdown-menu-right">
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#edit_notes"
                                >
                                  <i className="ti ti-edit me-1" />
                                  Edit
                                </Link>
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#delete_note"
                                >
                                  <i className="ti ti-trash me-1" />
                                  Delete
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                        <h5 className="fw-medium fs-14 mb-1">
                          Notes added by Antony
                        </h5>
                        <p className="mb-3">
                          A project review evaluates the success of an
                          initiative and identifies areas for improvement. It
                          can also evaluate a current project to determine
                          whether it's on the right track. Or, it can determine
                          the success of a completed project.
                        </p>
                        <div className="row">
                          <div className="col-xxl-4 col-lg-5">
                            <div className="card">
                              <div className="card-body p-2">
                                <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                                  <div className="d-flex align-items-center me-3">
                                    <span className="avatar bg-success me-2">
                                      <i className="ti ti-file-spreadsheet fs-20" />
                                    </span>
                                    <div>
                                      <h6 className="fw-medium fs-14 mb-1">
                                        Project Specs.xls
                                      </h6>
                                      <p className="mb-0">365 KB</p>
                                    </div>
                                  </div>
                                  <Link
                                    href="#"
                                    className="avatar avatar-xs rounded-circle bg-light text-dark"
                                  >
                                    <i className="ti ti-arrow-down" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-xxl-4 col-lg-5">
                            <div className="card bg-light">
                              <div className="card-body p-2">
                                <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                                  <div className="d-flex align-items-center me-3">
                                    <span className="avatar bg-success me-2">
                                      <ImageWithBasePath
                                        src="assets/img/media/media-35.jpg"
                                        alt="img"
                                      />
                                    </span>
                                    <div>
                                      <h6 className="fw-medium fs-14 mb-1">
                                        637.jpg
                                      </h6>
                                      <p className="mb-0">365 KB</p>
                                    </div>
                                  </div>
                                  <Link
                                    href="#"
                                    className="avatar avatar-xs rounded-circle bg-white text-dark"
                                  >
                                    <i className="ti ti-arrow-down" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="notes-editor">
                          <div className="note-edit-wrap">
                            <div className="editor pages-editor" />
                            <div className="text-end note-btns mt-3">
                              <Link
                                href="#"
                                className="btn btn-light add-cancel me-2"
                              >
                                Cancel
                              </Link>
                              <Link
                                href="#"
                                className="btn btn-primary"
                              >
                                Save
                              </Link>
                            </div>
                          </div>
                          <div className="text-end mt-2">
                            <Link
                              href="#"
                              className="add-comment link-primary fw-medium"
                            >
                              <i className="ti ti-circle-plus me-1" />
                              Add Comment
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="card mb-3">
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2 pb-2">
                          <div className="d-inline-flex align-items-center mb-2">
                            <span className="avatar avatar-md me-2 flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/profiles/avatar-20.jpg"
                                alt="img"
                              />
                            </span>
                            <div>
                              <h6 className="fw-medium fs-14 mb-1">
                                Sharon Roy
                              </h6>
                              <p className="mb-0">18 Sep 2023, 09:52 am</p>
                            </div>
                          </div>
                          <div className="mb-2">
                            <div className="dropdown">
                              <Link
                                href="#"
                                className="action-icon btn btn-icon btn-sm btn-outline-light shadow"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                              >
                                <i className="ti ti-dots-vertical" />
                              </Link>
                              <div className="dropdown-menu dropdown-menu-right">
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#edit_notes"
                                >
                                  <i className="ti ti-edit me-1" />
                                  Edit
                                </Link>
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#delete_note"
                                >
                                  <i className="ti ti-trash me-1" />
                                  Delete
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                        <h5 className="fw-medium fs-14 mb-1">
                          Notes added by Antony
                        </h5>
                        <p>
                          A project plan typically contains a list of the
                          essential elements of a project, such as stakeholders,
                          scope, timelines, estimated cost and communication
                          methods. The project manager typically lists the
                          information based on the assignment.
                        </p>
                        <div className="row">
                          <div className="col-xxl-4 col-lg-5">
                            <div className="card">
                              <div className="card-body p-2">
                                <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                                  <div className="d-flex align-items-center me-3">
                                    <span className="avatar bg-teal me-2">
                                      <i className="ti ti-file-spreadsheet fs-20" />
                                    </span>
                                    <div>
                                      <h6 className="fw-medium fs-14 mb-1">
                                        Andewpass.txt
                                      </h6>
                                      <p className="mb-0">365 KB</p>
                                    </div>
                                  </div>
                                  <Link
                                    href="#"
                                    className="avatar avatar-xs rounded-circle bg-light text-dark"
                                  >
                                    <i className="ti ti-arrow-down" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-light p-3 rounded">
                          <p className="mb-2">
                            The best way to get a project done faster is to
                            start sooner. A goal without a timeline is just a
                            dream.The goal you set must be challenging. At the
                            same time, it should be realistic and attainable,
                            not impossible to reach.
                          </p>
                          <p>
                            Commented by{" "}
                            <span className="text-info">Aeron</span> on 15 Sep
                            2024, 11:15 pm
                          </p>
                          <Link
                            href="#"
                            className="btn btn-outline-white bg-white btn-sm"
                          >
                            <i className="ti ti-arrow-back-up-double me-1" />
                            Reply
                          </Link>
                        </div>
                      </div>
                    </div>
                    <div className="card mb-0">
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2 pb-2">
                          <div className="d-inline-flex align-items-center mb-2">
                            <span className="avatar avatar-md me-2 flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/profiles/avatar-21.jpg"
                                alt="img"
                              />
                            </span>
                            <div>
                              <h6 className="fw-medium fs-14 mb-1">
                                Vaughan Lewis
                              </h6>
                              <p className="mb-0">20 Sep 2023, 10:26 pm</p>
                            </div>
                          </div>
                          <div className="mb-2">
                            <div className="dropdown">
                              <Link
                                href="#"
                                className="action-icon btn btn-icon btn-sm btn-outline-light shadow"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                              >
                                <i className="ti ti-dots-vertical" />
                              </Link>
                              <div className="dropdown-menu dropdown-menu-right">
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#edit_notes"
                                >
                                  <i className="ti ti-edit me-1" />
                                  Edit
                                </Link>
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#delete_note"
                                >
                                  <i className="ti ti-trash me-1" />
                                  Delete
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="mb-0">
                          Projects play a crucial role in the success of
                          organizations, and their importance cannot be
                          overstated. Whether it's launching a new product,
                          improving an existing
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Notes */}
            {/* Calls */}
            <div className="tab-pane fade" id="tab_3">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <h5 className="fw-semibold mb-0">Calls</h5>
                  <div className="d-inline-flex align-items-center">
                    <Link
                      href="#"
                      data-bs-toggle="modal"
                      data-bs-target="#create_call"
                      className="link-primary fw-medium"
                    >
                      <i className="ti ti-circle-plus me-1" />
                      Add New
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  <div className="card mb-3">
                    <div className="card-body">
                      <div className="d-sm-flex align-items-center justify-content-between pb-2">
                        <div className="d-flex align-items-center mb-2">
                          <span className="avatar avatar-md me-2 flex-shrink-0">
                            <ImageWithBasePath
                              src="assets/img/profiles/avatar-19.jpg"
                              alt="img"
                            />
                          </span>
                          <p className="mb-0">
                            <span className="text-dark fw-medium">
                              Darlee Robertson
                            </span>
                            logged a call on 23 Jul 2023, 10:00 pm
                          </p>
                        </div>
                        <div className="d-inline-flex align-items-center mb-2">
                          <div className="dropdown me-2">
                            <Link
                              href="#"
                              className="btn btn-sm btn-outline-light"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              Busy
                              <i className="ti ti-chevron-down ms-2" />
                            </Link>
                            <div className="dropdown-menu dropdown-menu-right">
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Busy
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                No Answer
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Unavailable
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Wrong Number
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Left Voice Message
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Moving Forward
                              </Link>
                            </div>
                          </div>
                          <div className="dropdown">
                            <Link
                              href="#"
                              className="action-icon btn btn-icon btn-sm btn-outline-light shadow"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              <i className="ti ti-dots-vertical" />
                            </Link>
                            <div className="dropdown-menu dropdown-menu-right">
                              <Link
                                className="dropdown-item"
                                href="#"
                                data-bs-toggle="modal"
                                data-bs-target="#edit_call"
                              >
                                <i className="ti ti-edit me-1" />
                                Edit
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                                data-bs-toggle="modal"
                                data-bs-target="#delete_call"
                              >
                                <i className="ti ti-trash me-1" />
                                Delete
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="mb-0">
                        A project review evaluates the success of an initiative
                        and identifies areas for improvement. It can also
                        evaluate a current project to determine whether it's on
                        the right track. Or, it can determine the success of a
                        completed project.
                      </p>
                    </div>
                  </div>
                  <div className="card mb-3">
                    <div className="card-body">
                      <div className="d-sm-flex align-items-center justify-content-between pb-2">
                        <div className="d-flex align-items-center mb-2">
                          <span className="avatar avatar-md me-2 flex-shrink-0">
                            <ImageWithBasePath
                              src="assets/img/profiles/avatar-20.jpg"
                              alt="img"
                            />
                          </span>
                          <p className="mb-0">
                            <span className="text-dark fw-medium">
                              Sharon Roy
                            </span>
                            logged a call on 18 Sep 2025, 09:52AM
                          </p>
                        </div>
                        <div className="d-inline-flex align-items-center mb-2">
                          <div className="dropdown me-2">
                            <Link
                              href="#"
                              className="btn btn-sm btn-outline-light"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              No Answrer
                              <i className="ti ti-chevron-down ms-2" />
                            </Link>
                            <div className="dropdown-menu dropdown-menu-right">
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                No Answrer
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Unavailable
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Wrong Number
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Left Voice Message
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Moving Forward
                              </Link>
                            </div>
                          </div>
                          <div className="dropdown">
                            <Link
                              href="#"
                              className="action-icon btn btn-icon btn-sm btn-outline-light shadow"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              <i className="ti ti-dots-vertical" />
                            </Link>
                            <div className="dropdown-menu dropdown-menu-right">
                              <Link
                                className="dropdown-item"
                                href="#"
                                data-bs-toggle="modal"
                                data-bs-target="#edit_call"
                              >
                                <i className="ti ti-edit me-1" />
                                Edit
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                                data-bs-toggle="modal"
                                data-bs-target="#delete_call"
                              >
                                <i className="ti ti-trash me-1" />
                                Delete
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="mb-0">
                        A project plan typically contains a list of the
                        essential elements of a project, such as stakeholders,
                        scope, timelines, estimated cost and communication
                        methods. The project manager typically lists the
                        information based on the assignment.
                      </p>
                    </div>
                  </div>
                  <div className="card mb-0">
                    <div className="card-body">
                      <div className="d-sm-flex align-items-center justify-content-between pb-2">
                        <div className="d-flex align-items-center mb-2">
                          <span className="avatar avatar-md me-2 flex-shrink-0">
                            <ImageWithBasePath
                              src="assets/img/profiles/avatar-21.jpg"
                              alt="img"
                            />
                          </span>
                          <p className="mb-0">
                            <span className="text-dark fw-medium">Vaughan</span>
                            logged a call on 20 Sep 2025, 10:26 PM
                          </p>
                        </div>
                        <div className="d-inline-flex align-items-center mb-2">
                          <div className="dropdown me-2">
                            <Link
                              href="#"
                              className="btn btn-sm btn-outline-light"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              No Answrer
                              <i className="ti ti-chevron-down ms-2" />
                            </Link>
                            <div className="dropdown-menu dropdown-menu-right">
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                No Answrer
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Unavailable
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Wrong Number
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Left Voice Message
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                              >
                                Moving Forward
                              </Link>
                            </div>
                          </div>
                          <div className="dropdown">
                            <Link
                              href="#"
                              className="action-icon btn btn-icon btn-sm btn-outline-light shadow"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              <i className="ti ti-dots-vertical" />
                            </Link>
                            <div className="dropdown-menu dropdown-menu-right">
                              <Link
                                className="dropdown-item"
                                href="#"
                                data-bs-toggle="modal"
                                data-bs-target="#edit_call"
                              >
                                <i className="ti ti-edit me-1" />
                                Edit
                              </Link>
                              <Link
                                className="dropdown-item"
                                href="#"
                                data-bs-toggle="modal"
                                data-bs-target="#delete_call"
                              >
                                <i className="ti ti-trash me-1" />
                                Delete
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="mb-0">
                        Projects play a crucial role in the success of
                        organizations, and their importance cannot be
                        overstated. Whether it's launching a new product,
                        improving an existing
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Calls */}
            {/* Files */}
            <div className="tab-pane fade" id="tab_4">
              <div className="card">
                <div className="card-header">
                  <h5 className="fw-semibold mb-0">Files</h5>
                </div>
                <div className="card-body">
                  <div className="card border mb-3">
                    <div className="card-body pb-0">
                      <div className="row align-items-center">
                        <div className="col-md-8">
                          <div className="mb-3">
                            <h6 className="mb-1">Manage Documents</h6>
                            <p>
                              Send customizable quotes, proposals and contracts
                              to close deals faster.
                            </p>
                          </div>
                        </div>
                        <div className="col-md-4 text-md-end">
                          <div className="mb-3">
                            <Link
                              href="#"
                              className="btn btn-primary"
                              data-bs-toggle="modal"
                              data-bs-target="#new_file"
                            >
                              Create Document
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card border shadow-none mb-3">
                    <div className="card-body pb-0">
                      <div className="row align-items-center">
                        <div className="col-md-8">
                          <div className="mb-3">
                            <h6 className="fw-semibold fs-14 mb-1">
                              Collier-Turner Proposal
                            </h6>
                            <p>
                              Send customizable quotes, proposals and contracts
                              to close deals faster.
                            </p>
                            <div className="d-flex align-items-center flex-wrap row-gap-2">
                              <span className="avatar avatar-md me-2 flex-shrink-0">
                                <ImageWithBasePath
                                  src="assets/img/profiles/avatar-21.jpg"
                                  alt="img"
                                  className="rounded-circle"
                                />
                              </span>
                              <div className="d-flex align-items-center">
                                <p className="mb-0 me-2">Vaughan Lewis</p>
                                <span className="badge bg-light text-body">
                                  Owner
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4 text-md-end">
                          <div className="mb-3 d-inline-flex align-items-center">
                            <span className="badge badge-soft-danger me-1">
                              Proposal
                            </span>
                            <span className="badge bg-info me-1">Draft</span>
                            <div className="dropdown">
                              <Link
                                href="#"
                                className="action-icon btn btn-icon btn-sm btn-outline-light shadow"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                              >
                                <i className="ti ti-dots-vertical" />
                              </Link>
                              <div className="dropdown-menu dropdown-menu-right">
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#delete_file"
                                >
                                  <i className="ti ti-trash me-1" />
                                  Delete
                                </Link>
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                >
                                  <i className="ti ti-download me-1" />
                                  Download
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card border shadow-none mb-3">
                    <div className="card-body pb-0">
                      <div className="row align-items-center">
                        <div className="col-md-8">
                          <div className="mb-3">
                            <h6 className="fw-semibold fs-14 mb-1">
                              Collier-Turner Proposal
                            </h6>
                            <p>
                              Send customizable quotes, proposals and contracts
                              to close deals faster.
                            </p>
                            <div className="d-flex align-items-center flex-wrap row-gap-2">
                              <span className="avatar avatar-md me-2 flex-shrink-0">
                                <ImageWithBasePath
                                  src="assets/img/profiles/avatar-01.jpg"
                                  alt="img"
                                  className="rounded-circle"
                                />
                              </span>
                              <div className="d-flex align-items-center">
                                <p className="mb-0 me-2">Jessica Louise</p>
                                <span className="badge bg-light text-body">
                                  Owner
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4 text-md-end">
                          <div className="mb-3 d-inline-flex align-items-center">
                            <span className="badge badge-purple-light me-1">
                              Quote
                            </span>
                            <span className="badge bg-success me-1">Sent</span>
                            <div className="dropdown">
                              <Link
                                href="#"
                                className="action-icon btn btn-icon btn-sm btn-outline-light shadow"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                              >
                                <i className="ti ti-dots-vertical" />
                              </Link>
                              <div className="dropdown-menu dropdown-menu-right">
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#delete_file"
                                >
                                  <i className="ti ti-trash me-1" />
                                  Delete
                                </Link>
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                >
                                  <i className="ti ti-download me-1" />
                                  Download
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card border shadow-none mb-0">
                    <div className="card-body pb-0">
                      <div className="row align-items-center">
                        <div className="col-md-8">
                          <div className="mb-3">
                            <h6 className="fw-semibold fs-14 mb-1">
                              Collier-Turner Proposal
                            </h6>
                            <p>
                              Send customizable quotes, proposals and contracts
                              to close deals faster.
                            </p>
                            <div className="d-flex align-items-center flex-wrap row-gap-2">
                              <span className="avatar avatar-md me-2 flex-shrink-0">
                                <ImageWithBasePath
                                  src="assets/img/profiles/avatar-22.jpg"
                                  alt="img"
                                  className="rounded-circle"
                                />
                              </span>
                              <div className="d-flex align-items-center">
                                <p className="mb-0 me-2">Dawn Merhca</p>
                                <span className="badge bg-light text-body">
                                  Owner
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4 text-md-end">
                          <div className="mb-3 d-inline-flex align-items-center">
                            <span className="badge badge-danger-light me-1">
                              Proposal
                            </span>
                            <span className="badge bg-pending priority-badge me-1">
                              Draft
                            </span>
                            <div className="dropdown">
                              <Link
                                href="#"
                                className="action-icon btn btn-icon btn-sm btn-outline-light shadow"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                              >
                                <i className="ti ti-dots-vertical" />
                              </Link>
                              <div className="dropdown-menu dropdown-menu-right">
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#delete_file"
                                >
                                  <i className="ti ti-trash me-1" />
                                  Delete
                                </Link>
                                <Link
                                  className="dropdown-item"
                                  href="#"
                                >
                                  <i className="ti ti-download me-1" />
                                  Download
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Files */}
            {/* Email */}
            <div className="tab-pane fade" id="tab_5">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <h5 className="mb-1">Email</h5>
                  <div className="d-inline-flex align-items-center">
                    <Link
                      href="#"
                      className="link-primary fw-medium"
                      data-bs-toggle="tooltip"
                      data-bs-placement="left"
                      data-bs-custom-class="tooltip-dark"
                      data-bs-original-title="There are no email accounts configured, Please configured your email account in order to Send/ Create EMails"
                    >
                      <i className="ti ti-circle-plus me-1" />
                      Create Email
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  <div className="card border mb-0">
                    <div className="card-body pb-0">
                      <div className="row align-items-center">
                        <div className="col-md-8">
                          <div className="mb-3">
                            <h6 className="mb-1">Manage Emails</h6>
                            <p>
                              You can send and reply to emails directly via this
                              section.
                            </p>
                          </div>
                        </div>
                        <div className="col-md-4 text-md-end">
                          <div className="mb-3">
                            <Link
                              href="#"
                              className="btn btn-primary"
                              data-bs-toggle="modal"
                              data-bs-target="#create_email"
                            >
                              Connect Account
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Email */}
          </div>
          {/* /Tab Content */}
        </div>
        {/* /Contact Details */}
      </div>
      {/* Start Footer */}
    </div>
    {/* End Content */}
    <Footer/>
    {/* End Footer */}
  </div>
  {/* ========================
			End Page Content
		========================= */}
    <ModalDealsDetails/>
</>

  )
}

export default DealsDetailsComponent