import React, { useState, useMemo } from 'react';
import Header from "../../ui/Header";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { useSelector, useDispatch} from "react-redux";
import { selectTicketById } from "../../../store/ticketSlice";
import styles from "./page.module.css";
import { Link } from 'react-router-dom';
import { Search, Plus, Building2, ClipboardList, Paperclip, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react';

const statusLabels = {
  open: 'In process',
  pending: 'Pending',
  closed: 'Closed',
  rejected: 'Rejected',
};

const statusColors = {
  open: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  closed: 'bg-gray-100 text-gray-700',
  rejected: 'bg-red-100 text-red-800',
};

const priorityColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-700',
};

export default function TicketList({ onCreateTicket, onViewTicket }) {

  // --- STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
   const [projectFilter, setProjectFilter] = useState('All Projects');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);


const tickets = useSelector(state => state.tickets.tickets);

const filteredTickets = useMemo(() => {
  return tickets.filter((ticket) => {
    const matchesSearch =
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase()); 

    const matchesStatus =
      statusFilter === "All Status" ||
      ticket.status === statusFilter.toLowerCase();

    const matchesProject =
      projectFilter === "All Projects" ||
      ticket.project === projectFilter;

    return matchesSearch && matchesStatus && matchesProject;
  });
}, [tickets, searchTerm, statusFilter,projectFilter]);

const dispatch = useDispatch();

// const openTicket = (ticketId) => {
//   dispatch(selectTicketById(ticketId));
  
// };

  // --- LOGIC: Pagination ---
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <>
    {/* <div className="relative min-h-screen bg-[linear-gradient(135deg,#f5f7fa_0%,#c3cfe2_100%)]">
  <div className="absolute inset-x-0 top-0 h-[300px] 
                  bg-[linear-gradient(135deg,#ff6b35_0%,#e85a2a_100%)]  */}
                  {/* opacity-[0.05]" /> */}
      <div className={styles.page}>
        <Header />

  {/* <main className="relative z-10 pb-16">
    <div className="w-full px-[50px] py-10 max-[600px]:px-5 max-[600px]:py-6">

      <div className="flex justify-between items-center mb-10 max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-3">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500">
            Track and manage all your support requests
          </p>
        </div> */}

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Support Tickets</h1>
              <p className={styles.subtitle}>Track and manage all your support requests</p>
            </div>
              <Link to="/app/support/createTicket">
              {/* <button
                className="bg-[#FF6B35] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#E85A2A] transition-colors flex items-center gap-2"
              > */}
              <Button variant="primary" size="lg"><Plus size={20} strokeWidth={3} />
                <span>Raise New Ticket</span>
                </Button>
              {/* </button> */}
              </Link>
          </div>
          {/* Search and Filters */}
          <Card className={styles.filterCard}>
          {/* <div className="bg-white p-6 rounded-xl shadow-sm mb-8"> */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by ID or subject..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#FF6B35] transition-colors"
                  
                />
              </div>
              <select 
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#FF6B35] bg-white cursor-pointer"
              >
                <option>All Status</option>
                <option>In process</option>
                <option>Pending</option>
                <option>Closed</option>
                <option>Rejected</option>
              </select>
              <select value={projectFilter}
                onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
              className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#FF6B35] bg-white cursor-pointer">
                <option>All Projects</option>
                <option>skyi-songbirds</option>
                <option>Green Valley Complex</option>
                <option>Ocean View Residency</option>
                <option>Downtown Plaza</option>
                <option>Hillside Villas</option>
              </select>
            </div>
          </Card>

          {/* Ticket Grid  onClick={() => onViewTicket(ticket.id)} */}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8" >
            {currentTickets.map((ticket) => (
            <Card key={ticket.id} className={styles.ticketCard} hoverable>
              {/* <div
                key={ticket.id} 
                className="bg-white rounded-xl p-6 shadow-sm border-2 hover:border-[#FF6B35] hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-1"
              > */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-bold text-[#FF6B35] text-sm bg-[#FFF4F0] px-2.5 py-1 rounded-md font-mono inline-block">
                      {ticket.id}
                    </div>
                    <div className="text-[13px] text-gray-500 mt-1">{ticket.createdDate}</div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <span className={`px-3 py-1 rounded-xl text-[13px] font-semibold ${statusColors[ticket.status]}`}>
                      {statusLabels[ticket.status]}
                    </span>
                    <span className={`px-3 py-1 rounded-xl text-[13px] font-semibold capitalize ${priorityColors[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                  </div>
                </div>

                <h3 className="text-[17px] font-semibold text-gray-900 mb-3 leading-snug line-clamp-2">
                  {ticket.subject}
                </h3>

                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1.5"><Building2 size={14} className="text-gray-400" /> {ticket.project}</span>
                  <span className="flex items-center gap-1.5"><ClipboardList size={14} className="text-gray-400" /> {ticket.category}</span>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <span className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Paperclip size={14} className="text-gray-400" /> {ticket.attachmentCount} attachments
                  </span>
                  {/* <Link to="/app/support/ticketDetail" onClick={() => openTicket}> */}
                  <Link to={`/app/support/ticket/${ticket.id}`} onClick={() => dispatch(selectTicketById(ticket.id))}>
                  <span className="text-[#FF6B35] font-semibold text-sm flex items-center gap-1">
                    View Details <ChevronRight size={16} />
                  </span>
                  </Link>
                </div>
             </Card>
            ))}
          </div>

          {/* No Results State */}
          {currentTickets.length === 0 && (
            <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-500 font-medium">No tickets found matching your criteria.</p>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex flex-wrap justify-center items-center gap-2 mt-8">
            <button 
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="w-9 h-9 border border-gray-200 bg-white rounded-md hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronsLeft size={16} />
            </button>
            <button 
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-9 h-9 border border-gray-200 bg-white rounded-md hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => goToPage(i + 1)}
                className={`w-9 h-9 rounded-md flex items-center justify-center font-medium transition-colors border ${
                  currentPage === i + 1 
                    ? 'bg-[#FF6B35] text-white border-[#FF6B35]' 
                    : 'bg-white text-gray-700 border-gray-200 hover:border-[#FF6B35] hover:text-[#FF6B35]'
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button 
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-9 h-9 border border-gray-200 bg-white rounded-md hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
            <button 
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="w-9 h-9 border border-gray-200 bg-white rounded-md hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronsRight size={16} />
            </button>

            <div className="flex items-center gap-3 ml-4">
              <span className="text-gray-600 text-sm whitespace-nowrap">Showing {itemsPerPage} per page</span>
              <select 
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="min-w-[80px] px-3 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer text-sm focus:border-[#FF6B35] outline-none"
              >
                <option value={2}>2</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
      </div>
    </main>
    </div>
    </>
  );
}