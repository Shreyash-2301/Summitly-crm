"use client";
/* eslint-disable @next/next/no-img-element */
import Footer from "@/core/common/footer/footer";
import PageHeader from "@/core/common/page-header/pageHeader";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useState, useEffect } from "react";
import ImageWithBasePath from "@/core/common/imageWithBasePath";
import type { NormalizedScarlettDeal } from "@/core/types/scarlettDeal";
import ModalDeals from "./modal/modalDeals";
import Link from "next/link";
import { all_routes } from "@/router/all_routes";

interface KanbanCard {
  id: string;
  avatar: { text: string; color: string };
  name: string;
  amount: string;
  email: string;
  phone: string;
  location: string;
  owner: { name: string; img: string };
  progress: { value: number; color: string };
  date: string;
  highlighted?: boolean;
}

interface KanbanColumn {
  id: string;
  title: string;
  leads: number;
  amount: string;
  cards: KanbanCard[];
}

const DealsGridComponent = () => {
  // Kanban data
  const initialColumns: KanbanColumn[] = [
    { id: 'new',               title: 'New',               leads: 0, amount: '$0', cards: [] },
    { id: 'work-in-progress',  title: 'Work in Progress',  leads: 0, amount: '$0', cards: [] },
    { id: 'submitted',         title: 'Submitted',         leads: 0, amount: '$0', cards: [] },
    { id: 'compliance-review', title: 'Compliance Review', leads: 0, amount: '$0', cards: [] },
    { id: 'approved',          title: 'Approved',          leads: 0, amount: '$0', cards: [] },
    { id: 'ready-to-close',    title: 'Ready to Close',    leads: 0, amount: '$0', cards: [] },
    { id: 'closed-funded',     title: 'Closed / Funded',   leads: 0, amount: '$0', cards: [] },
    { id: 'paid-finalized',    title: 'Paid & Finalized',  leads: 0, amount: '$0', cards: [] },
    { id: 'cancelled',         title: 'Cancelled',         leads: 0, amount: '$0', cards: [] },
    { id: 'declined',          title: 'Declined',          leads: 0, amount: '$0', cards: [] },
  ];

  // -----------------------------------------------------------------------
  // Scarlett CRM live data: fetch grouped by stage so every column is correct
  // -----------------------------------------------------------------------
  const [liveColumns, setLiveColumns]   = useState(initialColumns);
  const [dataSource,  setDataSource]    = useState<'live' | 'fallback'>('fallback');
  const [loading,     setLoading]       = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [totalDeals,  setTotalDeals]    = useState(0);
  const [lastSync,    setLastSync]      = useState<string | null>(null);

  /** Scarlett stage name → kanban column id */
  const STAGE_TO_COL: Record<string, string> = {
    'New':               'new',
    'Work in Progress':  'work-in-progress',
    'Submitted':         'submitted',
    'Compliance Review': 'compliance-review',
    'Approved':          'approved',
    'Ready to Close':    'ready-to-close',
    'Closed / Funded':   'closed-funded',
    'Paid & Finalized':  'paid-finalized',
    'Renewed':           'paid-finalized',
    'Cancelled':         'cancelled',
    'Declined':          'declined',
  };

  function dealsToCards(deals: NormalizedScarlettDeal[], highlight: string): KanbanCard[] {
    return deals.map((d, i) => {
      const initials  = d.DealName.split(' ').map((w) => w[0] ?? '').join('').substring(0, 2).toUpperCase();
      const colors    = ['success', 'warning', 'info', 'danger', 'purple'];
      const color     = colors[i % colors.length];
      const prob      = parseFloat(String(d.Probability).replace('%', '').trim()) || 50;
      const probColor = prob >= 70 ? 'success' : prob >= 40 ? 'info' : 'danger';
      const hl = highlight.toLowerCase();
      const tagArr = Array.isArray(d.Tags) ? d.Tags : (d.Tags ? [String(d.Tags)] : []);
      const isHighlighted = highlight.length > 0 && (
        d.DealName.toLowerCase().includes(hl) ||
        (d.key ?? '').toLowerCase().includes(hl) ||
        tagArr.some((t: string) => t.toLowerCase().includes(hl))
      );
      return {
        id:       d.key,
        avatar:   { text: initials || 'D', color: isHighlighted ? 'warning' : color },
        name:     d.DealName,
        amount:   d.DealValue,
        email:    d.Email || 'N/A',
        phone:    d.Phone || 'N/A',
        location: d.PropertyAddress || 'Scarlett CRM',
        owner:    { name: d.DealName, img: 'assets/img/profiles/avatar-19.jpg' },
        progress: { value: Math.min(100, Math.max(0, prob)), color: probColor },
        date:     d.ExpectedCloseDate,
        highlighted: isHighlighted,
      } as KanbanCard & { highlighted?: boolean };
    });
  }

  async function loadKanbanDeals(search = '') {
    setLoading(true);
    try {
      const url = `/api/scarlett-deals?grouped=true&limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (!json.success || !json.groups) return;

      const groups: Record<string, { total: number; cards: NormalizedScarlettDeal[] }> = json.groups;

      setLiveColumns((prev) =>
        prev.map((col) => {
          // Find the Scarlett stage key that maps to this column
          const stageKey = Object.keys(STAGE_TO_COL).find((k) => STAGE_TO_COL[k] === col.id);
          const group    = stageKey ? groups[stageKey] : null;
          return {
            ...col,
            leads:  group ? group.total  : 0,
            amount: group && group.total > 0 ? `${group.total} deals` : '$0',
            cards:  group ? dealsToCards(group.cards, search) : [],
          };
        })
      );
      setDataSource(json.source ?? 'fallback');
      setTotalDeals(json.grandTotal ?? 0);
      setLastSync(json.lastSync ? new Date(json.lastSync).toLocaleString() : null);
    } catch (err) {
      console.error('[DealsGridComponent] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKanbanDeals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function KanbanBoard() {
    const [columns, setColumns] = useState(liveColumns);

    // Drag and drop handler
    const onDragEnd = (result: any) => {
      if (!result.destination) return;
      const { source, destination } = result;

      if (source.droppableId === destination.droppableId) {
        // Move within same column
        const colIdx = columns.findIndex(
          (col) => col.id === source.droppableId
        );
        const newCards = Array.from(columns[colIdx].cards);
        const [removed] = newCards.splice(source.index, 1);
        newCards.splice(destination.index, 0, removed);

        const newColumns = [...columns];
        newColumns[colIdx] = { ...columns[colIdx], cards: newCards };
        setColumns(newColumns);
      } else {
        // Move to another column
        const sourceColIdx = columns.findIndex(
          (col) => col.id === source.droppableId
        );
        const destColIdx = columns.findIndex(
          (col) => col.id === destination.droppableId
        );

        const sourceCards = Array.from(columns[sourceColIdx].cards);
        const destCards = Array.from(columns[destColIdx].cards);

        const [removed] = sourceCards.splice(source.index, 1);
        destCards.splice(destination.index, 0, removed);

        const newColumns = [...columns];
        newColumns[sourceColIdx] = {
          ...columns[sourceColIdx],
          cards: sourceCards,
        };
        newColumns[destColIdx] = { ...columns[destColIdx], cards: destCards };
        setColumns(newColumns);
      }
    };

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="d-flex overflow-x-auto align-items-start mb-0 gap-3">
          {columns.map((col, _colIdx) => (
            <div
              className="kanban-list-items p-2 rounded border"
              key={col.id}
              style={{ minWidth: 300 }}
            >
              <div className="card mb-0 border-0 shadow">
                <div className="card-body p-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="d-flex align-items-center mb-1">
                        <i className="ti ti-circle-filled fs-10 text-info me-1" />
                        {col.title}
                      </h6>
                      <span>
                        {col.leads} Leads - {col.amount}
                      </span>
                    </div>
                    <div className="d-flex align-items-center">
                      <div className="dropdown table-action ms-2">
                        <Link
                          href="#"
                          className="action-icon btn btn-xs shadow btn-icon btn-outline-light"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          <i className="ti ti-dots-vertical" />
                        </Link>
                        <div className="dropdown-menu dropdown-menu-right">
                          <Link
                            className="dropdown-item"
                            href="#"
                            data-bs-toggle="offcanvas"
                            data-bs-target="#offcanvas_edit"
                          >
                            <i className="ti ti-pencil me-1" />Edit
                          </Link>
                          <Link
                            className="dropdown-item"
                            href="#"
                            data-bs-toggle="modal"
                            data-bs-target="#delete_deal"
                          >
                            <i className="ti ti-trash me-1" />Delete
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Droppable droppableId={col.id}>
                {(provided: any) => (
                  <div
                    className="kanban-drag-wrap"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{ minHeight: 100 }}
                  >
                    {col.cards.map((card, idx) => (
                      <Draggable
                        draggableId={card.id}
                        index={idx}
                        key={card.id}
                      >
                        {(provided: any, snapshot: any) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              marginBottom: 16,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                            }}
                          >
                            <div
                              className={`card kanban-card mb-0 mt-3 ${
                                (card as any).highlighted
                                  ? 'border border-warning shadow-lg'
                                  : 'border shadow'
                              }`}
                              style={(card as any).highlighted ? { boxShadow: '0 0 0 3px rgba(255,193,7,0.55)', transition: 'box-shadow 0.2s' } : {}}
                            >
                              <div className="card-body">
                                <div className="d-block">
                                  <div className="d-flex align-items-center mb-3">
                                    {(card as any).highlighted && (
                                      <span
                                        className="badge bg-warning text-dark me-2 py-1 px-2 rounded-pill"
                                        style={{ fontSize: 10 }}
                                        title="Search match"
                                      >
                                        <i className="ti ti-search me-1" />Match
                                      </span>
                                    )}
                                    <Link
                                        href={`/crm/deals-details/${card.id}`}
                                      className={`avatar bg-soft-${card.avatar.color} text-${card.avatar.color} rounded-circle flex-shrink-0 me-2`}
                                    >
                                      <span
                                        className={`avatar-title text-${card.avatar.color}`}
                                      >
                                        {card.avatar.text}
                                      </span>
                                    </Link>
                                    <h6 className="fw-medium fs-14 mb-0">
                                        <Link href={`/crm/deals-details/${card.id}`}>
                                        {card.name}
                                      </Link>
                                    </h6>
                                  </div>
                                </div>
                                <div className="d-flex flex-column">
                                  <p className="text-default d-inline-flex align-items-center mb-2">
                                    <i className="ti ti-report-money text-dark me-1" />
                                    {card.amount}
                                  </p>
                                  <p className="text-default d-inline-flex align-items-center mb-2">
                                    <i className="ti ti-mail text-dark me-1" />
                                    {card.email}
                                  </p>
                                  <p className="text-default d-inline-flex align-items-center mb-2">
                                    <i className="ti ti-phone text-dark me-1" />
                                    {card.phone}
                                  </p>
                                  <p className="text-default d-inline-flex align-items-center">
                                    <i className="ti ti-map-pin-pin text-dark me-1" />
                                    {card.location}
                                  </p>
                                </div>
                                <div className="d-flex justify-content-between align-items-center">
                                  <div className="d-flex align-items-center">
                                    <Link
                                      href="#"
                                      className="avatar avatar-xs flex-shrink-0 me-2"
                                    >
                                      <ImageWithBasePath
                                        src={card.owner.img}
                                        alt=""
                                        className="rounded-circle"
                                      />
                                    </Link>
                                    <Link href="#" className="text-default">
                                      {card.owner.name}
                                    </Link>
                                  </div>
                                  <span
                                    className={`badge bg-${card.progress.color}`}
                                  >
                                    {card.progress.value}%
                                  </span>
                                </div>
                                <div className="d-flex align-items-center justify-content-between border-top pt-3 mt-3">
                                  <span>
                                    <i className="ti ti-calendar-due" />{" "}
                                    {card.date}
                                  </span>
                                  <div className="icons-social d-flex align-items-center gap-1">
                                    <Link
                                      href="#"
                                      className="d-flex align-items-center justify-content-center me-1"
                                    >
                                      <i className="ti ti-phone-check" />
                                    </Link>
                                    <Link
                                      href="#"
                                      className="d-flex align-items-center justify-content-center me-1"
                                    >
                                      <i className="ti ti-message-circle-2" />
                                    </Link>
                                    <Link
                                      href="#"
                                      className="d-flex align-items-center justify-content-center"
                                    >
                                      <i className="ti ti-color-swatch" />
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    );
  }

  // ...existing code...

  return (
    <>
      {/* ========================
			Start Page Content
		========================= */}
      <div className="page-wrapper">
        {/* Start Content */}
        <div className="content">
          {/* Page Header */}
          <PageHeader
            title="Deals"
            badgeCount={totalDeals || 125}
            showModuleTile={false}
            showExport={true}
          />
          {/* Scarlett CRM data source badge */}
          <div className="d-flex align-items-center gap-2 px-1 pb-2 flex-wrap">
            {loading ? (
              <span className="badge rounded-pill bg-info fs-11">
                <i className="ti ti-loader-2 me-1" />Loading Scarlett CRM…
              </span>
            ) : (
              <span
                className={`badge rounded-pill fs-11 ${
                  dataSource === 'live' ? 'bg-success' : 'bg-warning text-dark'
                }`}
              >
                <i className={`ti ${
                  dataSource === 'live' ? 'ti-plug-connected' : 'ti-alert-triangle'
                } me-1`} />
                {dataSource === 'live'
                  ? `Live — Scarlett CRM · ${totalDeals.toLocaleString()} deals`
                  : 'Demo data — Scarlett has no deals endpoint'}
              </span>
            )}
            {!loading && lastSync && (
              <span className="badge rounded-pill bg-light text-muted border fs-11">
                <i className="ti ti-clock me-1" />Last sync: {lastSync}
              </span>
            )}
          </div>
          {/* End Page Header */}
          {/* table header */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="dropdown">
                <Link
                  href="#"
                  className="btn btn-outline-light shadow px-2"
                  data-bs-toggle="dropdown"
                  data-bs-auto-close="outside"
                >
                  <i className="ti ti-filter me-2" />
                  Filter
                  <i className="ti ti-chevron-down ms-2" />
                </Link>
                <div className="filter-dropdown-menu dropdown-menu dropdown-menu-lg p-0">
                  <div className="filter-header d-flex align-items-center justify-content-between border-bottom">
                    <h6 className="mb-0">
                      <i className="ti ti-filter me-1" />
                      Filter
                    </h6>
                    <button
                      type="button"
                      className="btn-close close-filter-btn"
                      data-bs-dismiss="dropdown-menu"
                      aria-label="Close"
                    />
                  </div>
                  <div className="filter-set-view p-3">
                    <div className="accordion" id="accordionExample">
                      <div className="filter-set-content">
                        <div className="filter-set-content-head">
                          <Link
                            href="#"
                            className="collapsed"
                            data-bs-toggle="collapse"
                            data-bs-target="#collapseThree"
                            aria-expanded="false"
                            aria-controls="collapseThree"
                          >
                            Deals Name
                          </Link>
                        </div>
                        <div
                          className="filter-set-contents accordion-collapse collapse"
                          id="collapseThree"
                          data-bs-parent="#accordionExample"
                        >
                          <div className="filter-content-list bg-light rounded border p-2 shadow mt-2">
                            <div className="mb-1">
                              <div className="input-icon-start input-icon position-relative">
                                <span className="input-icon-addon fs-12">
                                  <i className="ti ti-search" />
                                </span>
                                <input
                                  type="text"
                                  className="form-control form-control-md"
                                  placeholder="Search"
                                />
                              </div>
                            </div>
                            <ul>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Konopelski
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Adams
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Gutkowski
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Walter
                                </label>
                              </li>
                              <li>
                                <Link
                                  href="#"
                                  className="link-primary text-decoration-underline p-2 pt-0 d-flex"
                                >
                                  Load More
                                </Link>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="filter-set-content">
                        <div className="filter-set-content-head">
                          <Link
                            href="#"
                            className="collapsed"
                            data-bs-toggle="collapse"
                            data-bs-target="#owner"
                            aria-expanded="false"
                            aria-controls="owner"
                          >
                            Owner
                          </Link>
                        </div>
                        <div
                          className="filter-set-contents accordion-collapse collapse"
                          id="owner"
                          data-bs-parent="#accordionExample"
                        >
                          <div className="filter-content-list bg-light rounded border p-2 shadow mt-2">
                            <div className="mb-1">
                              <div className="input-icon-start input-icon position-relative">
                                <span className="input-icon-addon fs-12">
                                  <i className="ti ti-search" />
                                </span>
                                <input
                                  type="text"
                                  className="form-control form-control-md"
                                  placeholder="Search"
                                />
                              </div>
                            </div>
                            <ul className="mb-0">
                              <li className="mb-1">
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Hendry Milner
                                </label>
                              </li>
                              <li className="mb-1">
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Guilory Berggren
                                </label>
                              </li>
                              <li className="mb-1">
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Jami Carlile
                                </label>
                              </li>
                              <li className="mb-1">
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Theresa Nelson
                                </label>
                              </li>
                              <li className="mb-1">
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Smith Cooper
                                </label>
                              </li>
                              <li>
                                <Link
                                  href="#"
                                  className="link-primary text-decoration-underline p-2 pt-0 d-flex"
                                >
                                  Load More
                                </Link>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="filter-set-content">
                        <div className="filter-set-content-head">
                          <Link
                            href="#"
                            className="collapsed"
                            data-bs-toggle="collapse"
                            data-bs-target="#Status"
                            aria-expanded="false"
                            aria-controls="Status"
                          >
                            Status
                          </Link>
                        </div>
                        <div
                          className="filter-set-contents accordion-collapse collapse"
                          id="Status"
                          data-bs-parent="#accordionExample"
                        >
                          <div className="filter-content-list bg-light rounded border p-2 shadow mt-2">
                            <ul>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Won
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Open
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Lost
                                </label>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="filter-set-content">
                        <div className="filter-set-content-head">
                          <Link
                            href="#"
                            className="collapsed"
                            data-bs-toggle="collapse"
                            data-bs-target="#collapseOne"
                            aria-expanded="false"
                            aria-controls="collapseOne"
                          >
                            Rating
                          </Link>
                        </div>
                        <div
                          className="filter-set-contents accordion-collapse collapse"
                          id="collapseOne"
                          data-bs-parent="#accordionExample"
                        >
                          <div className="filter-content-list bg-light rounded border p-2 shadow mt-2">
                            <ul>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  <span className="rating">
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <span className="ms-1">5.0</span>
                                  </span>
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  <span className="rating">
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled" />
                                    <span className="ms-1">4.0</span>
                                  </span>
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  <span className="rating">
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled" />
                                    <i className="ti ti-star-filled" />
                                    <span className="ms-1">3.0</span>
                                  </span>
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  <span className="rating">
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled" />
                                    <i className="ti ti-star-filled" />
                                    <i className="ti ti-star-filled" />
                                    <span className="ms-1">2.0</span>
                                  </span>
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  <span className="rating">
                                    <i className="ti ti-star-filled text-warning" />
                                    <i className="ti ti-star-filled" />
                                    <i className="ti ti-star-filled" />
                                    <i className="ti ti-star-filled" />
                                    <i className="ti ti-star-filled" />
                                    <span className="ms-1">1.0</span>
                                  </span>
                                </label>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="filter-set-content">
                        <div className="filter-set-content-head">
                          <Link
                            href="#"
                            className="collapsed"
                            data-bs-toggle="collapse"
                            data-bs-target="#tags"
                            aria-expanded="false"
                            aria-controls="tags"
                          >
                            Tags
                          </Link>
                        </div>
                        <div
                          className="filter-set-contents accordion-collapse collapse"
                          id="tags"
                          data-bs-parent="#accordionExample"
                        >
                          <div className="filter-content-list bg-light rounded border p-2 shadow mt-2">
                            <ul>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Promotion
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Rated
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Rejected
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Collab
                                </label>
                              </li>
                              <li>
                                <label className="dropdown-item px-2 d-flex align-items-center">
                                  <input
                                    className="form-check-input m-0 me-1"
                                    type="checkbox"
                                  />
                                  Calls
                                </label>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <Link href="#" className="btn btn-outline-light w-100">
                        Reset
                      </Link>
                      <Link href="" className="btn btn-primary w-100">
                        Filter
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              <div className="input-icon input-icon-start position-relative">
                <span className="input-icon-addon text-dark">
                  <i className="ti ti-search" />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search deals, broker, email…"
                  value={searchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setSearchQuery(q);
                    loadKanbanDeals(q);
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link position-absolute end-0 top-50 translate-middle-y pe-2 text-muted"
                    onClick={() => { setSearchQuery(''); loadKanbanDeals(''); }}
                    title="Clear search"
                    style={{ zIndex: 10 }}
                  >
                    <i className="ti ti-x" />
                  </button>
                )}
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="d-flex align-items-center shadow p-1 rounded border view-icons bg-white">
                <Link
                  href={all_routes.dealsList}
                  className="btn btn-sm p-1 border-0 fs-14"
                >
                  <i className="ti ti-list-tree" />
                </Link>
                <Link
                  href={all_routes.dealsGrid}
                  className="flex-shrink-0 btn btn-sm p-1 border-0 ms-1 fs-14 active"
                >
                  <i className="ti ti-grid-dots" />
                </Link>
              </div>
              <Link
                href="#"
                className="btn btn-primary"
                data-bs-toggle="offcanvas"
                data-bs-target="#offcanvas_add"
              >
                <i className="ti ti-square-rounded-plus-filled me-1" />
                Add Deal
              </Link>
            </div>
          </div>
          {/* table header */}
          {/* Deals Kanban */}
          <KanbanBoard />
          {/* /Deals Kanban */}
        </div>
        {/* End Content */}
        {/* Start Footer */}
        <Footer />
        {/* End Footer */}
      </div>
      {/* ========================
			End Page Content
		========================= */}
    <ModalDeals/>
    </>
  );
};

export default DealsGridComponent;
