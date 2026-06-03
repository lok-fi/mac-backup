import React, { useState, useEffect} from 'react';
import { useSelector,useDispatch } from "react-redux";
import Header from '../../ui/Header';
import { useParams  } from 'react-router-dom';
import { selectTicketById } from "../../../store/ticketSlice";
import { Paperclip } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from "./page.module.css";


const statusColors = {
  open: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  closed: 'bg-gray-100 text-gray-700',
  rejected: 'bg-red-100 text-red-800',
};

const statusLabels = {
  open: 'In process',
  pending: 'Pending',
  closed: 'Closed',
  rejected: 'Rejected',
};

const priorityColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-700',
};

export default function TicketDetail() {
  const [activeTab, setActiveTab] = useState('conversations');
  const { ticketId } = useParams();
const dispatch = useDispatch();

useEffect(() => {
  dispatch(selectTicketById(ticketId));
}, [ticketId]);

const mockTicket = useSelector(state => state.tickets.selectedTicket);
console.log(mockTicket);

if (!mockTicket) {
  return <p className="p-6">No ticket selected</p>;
}
  return (
    <>   
     <div className={styles.page}>
      <Header />

      <main className={styles.main}>
      <div className={styles.container}>
    <main className="h-[calc(100vh-73px)] flex px-6">
      {/* LEFT SIDEBAR: Ticket Info */}
      <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <Link to="/app/support">
          <button
            className="text-gray-600 hover:text-[#FF6B35] transition-colors mb-4 inline-flex items-center gap-2 text-sm font-medium"
          >
            <span>←</span>
            <span>Back to Tickets</span>
          </button>
          </Link>
          <h2 className="text-lg font-bold text-gray-900">Ticket Details</h2>
        </div>

        <div className="p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">Ticket Information</h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 font-medium block mb-1">Property</label>
              <p className="text-sm text-gray-900">{mockTicket.project}</p>
            </div>

            <div>
              <label className="text-sm text-gray-600 font-medium block mb-1">Category</label>
              <p className="text-sm text-gray-900">{mockTicket.category}</p>
            </div>

            <div>
              <label className="text-sm text-gray-600 font-medium block mb-1">Subject</label>
              <p className="text-sm text-gray-900">{mockTicket.subject}</p>
            </div>

            <div>
              <label className="text-sm text-gray-600 font-medium block mb-1">Status</label>
              <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${statusColors[mockTicket.status]}`}>
                {statusLabels[mockTicket.status]}
              </span>
            </div>

            <div>
              <label className="text-sm text-gray-600 font-medium block mb-1">Priority</label>
              <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${priorityColors[mockTicket.priority]}`}>{mockTicket.priority}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT CONTENT: Conversations*/}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        {/* Top Header Section */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="font-bold text-gray-900 text-base">{mockTicket.id}</span>
              <span className="text-gray-600">Vignesh E</span>
              <span className="text-gray-500 text-sm">02:56 PM</span>
              <span className="text-gray-500 text-sm font-mono">00:00:03</span>
            </div>
          </div>

          <div className="mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
            <p className="text-sm text-gray-900 leading-relaxed">{mockTicket.description}</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 border-b border-gray-200 -mb-px">
            {['conversations', 'attachment'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors uppercase ${
                  activeTab === tab
                    ? 'border-[#FF6B35] text-[#FF6B35]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'conversations' ? `${mockTicket.replies?.length || 0} CONVERSATIONS` : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'conversations' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {mockTicket.replies.map((reply) => (
                <div key={reply.id} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 border-2 border-emerald-600">
                    {reply.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-gray-900">{reply.author}</span>
                      <span className="text-sm text-gray-500">{reply.date}</span>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                      <div className="text-gray-900 whitespace-pre-line leading-relaxed">
                        {reply.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Reply Box */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <textarea
                  placeholder="Write your reply..."
                  className="w-full min-h-[120px] p-4 border border-gray-300 rounded-lg resize-y focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] bg-white"
                />
                <div className="mt-3 flex justify-between items-center">
                  <button className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1.5">
                    <Paperclip size={14} className="text-gray-400" /> Attach Files
                  </button>
                  <button className="bg-[#FF6B35] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#E85A2A] transition-colors">
                    Reply
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attachment' && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500">No attachments available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
    </div>
    </main>
    </div>
    </>
  );
}


// import React from 'react';
// import Header from '../ui/Header';
// import { ArrowLeft, Building2, ClipboardList, Calendar, Send, Paperclip, Clock, ShieldAlert } from 'lucide-react';

// const mockTicket = {
//   id: '#2024-001',
//   subject: 'Air conditioning not working properly in unit 5B',
//   description: 'The AC unit has been making strange noises and not cooling properly for the past 3 days. The temperature is consistently higher than the set point, and there seems to be reduced airflow from the vents. This is causing discomfort to the residents, especially during the afternoon hours.',
//   status: 'open',
//   priority: 'high',
//   project: 'skyi-songbirds',
//   category: 'Maintenance',
//   createdDate: '04/02/2026, 10:30 AM',
//   attachmentCount: 0,
//   replies: [
//     {
//       id: '1',
//       author: 'Support Team',
//       avatar: 'ST',
//       content: 'We have received your ticket and assigned a technician. They will contact you within 24 hours to schedule a visit.',
//       date: '04/02/2026, 2:30 PM',
//     },
//     {
//       id: '2',
//       author: 'Support Team',
//       avatar: 'ST',
//       content: 'Our technician will visit tomorrow at 2 PM. Please ensure someone is available to provide access to the unit.',
//       date: '05/02/2026, 9:15 AM',
//     },
//   ],
// };

// const statusColors = {
//   open: 'bg-emerald-100 text-emerald-800',
//   pending: 'bg-amber-100 text-amber-800',
//   closed: 'bg-gray-100 text-gray-700',
//   rejected: 'bg-red-100 text-red-800',
// };

// const statusLabels = {
//   open: 'In process',
//   pending: 'Pending',
//   closed: 'Closed',
//   rejected: 'Rejected',
// };

// export default function TicketDetail({ onBack }) {
//   return (
//     <>
//     <Header/>
//     <div >
//       {/* Background Decorative Overlay className="min-h-screen bg-gradient-to-br from-[#f5f7fa] to-[#c3cfe2] relative" */}
//       <div className="absolute top-0 left-0 right-0 opacity-5 z-0"></div>
//       {/* h-[300px] bg-gradient-to-br from-[#FF6B35] to-[#E85A2A]  */}

//       <main className="relative z-10 max-w-[1000px] mx-auto px-6 py-12 ">
        
//         {/* Navigation */}
//         <button
//           onClick={onBack}
//           className="flex items-center gap-2 px-5 py-2.5 mb-8 font-medium text-gray-700 transition-all bg-white border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35] shadow-sm group"
//         >
//           <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
//           Back to Tickets
//         </button>

//         {/* Main Ticket Card */}
//         <div className="bg-white border border-gray-100 shadow-xl rounded-2xl overflow-hidden mb-8">
//           <div className="p-8 border-b border-gray-100 bg-gray-50/30">
//             <div className="flex flex-col md:flex-row justify-between items-start gap-6">
//               <div className="flex-1">
//                 <div className="inline-flex items-center px-3 py-1 rounded-md bg-orange-50 text-[#FF6B35] font-mono font-bold text-sm mb-4 border border-orange-100">
//                   {mockTicket.id}
//                 </div>
//                 <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-4">
//                   {mockTicket.subject}
//                 </h1>
//                 <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-gray-500 font-medium">
//                   <div className="flex items-center gap-1.5"><Building2 size={16} /> {mockTicket.project}</div>
//                   <div className="flex items-center gap-1.5"><ClipboardList size={16} /> {mockTicket.category}</div>
//                   <div className="flex items-center gap-1.5"><Clock size={16} /> {mockTicket.createdDate}</div>
//                 </div>
//               </div>

//               <div className="flex flex-row md:flex-col gap-3">
//                 <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-center border ${statusColors[mockTicket.status]}`}>
//                   {statusLabels[mockTicket.status]}
//                 </span>
//                 <span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100 flex items-center justify-center gap-1">
//                   <ShieldAlert size={12} /> High Priority
//                 </span>
//               </div>
//             </div>
//           </div>

//           <div className="p-8 space-y-10">
//             {/* Description Area */}
//             <div className="space-y-4">
//               <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
//                 <div className="w-1 h-6 bg-[#FF6B35] rounded-full"></div>
//                 Description
//               </h3>
//               <div className="p-6 text-gray-700 leading-relaxed bg-gray-50 rounded-2xl border-l-4 border-[#FF6B35] shadow-inner">
//                 {mockTicket.description}
//               </div>
//             </div>

//             {/* Attachments Area */}
//             <div className="space-y-4">
//               <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
//                 <div className="w-1 h-6 bg-[#FF6B35] rounded-full"></div>
//                 Attachments ({mockTicket.attachmentCount})
//               </h3>
//               <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 text-gray-400 italic text-sm">
//                 <Paperclip size={20} className="mb-2 opacity-30" />
//                 No files attached to this ticket
//               </div>
//             </div>

//             {/* Admin Actions */}
//             <div className="pt-6 border-t border-gray-100">
//               <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Status Management</h3>
//               <div className="flex flex-wrap gap-3">
//                 <button className="px-6 py-2.5 font-bold text-emerald-600 border-2 border-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all text-sm">
//                   Reopen Ticket
//                 </button>
//                 <button className="px-6 py-2.5 font-bold text-amber-500 border-2 border-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all text-sm">
//                   Move to Pending
//                 </button>
//                 <button className="px-6 py-2.5 font-bold text-gray-400 border-2 border-gray-200 rounded-xl hover:bg-gray-400 hover:text-white hover:border-gray-400 transition-all text-sm">
//                   Close Ticket
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Communication History */}
//         <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
//           <h3 className="flex items-center gap-2 mb-8 text-lg font-bold text-gray-800">
//             <div className="w-1 h-6 bg-[#FF6B35] rounded-full"></div>
//             Communication ({mockTicket.replies.length})
//           </h3>

//           <div className="space-y-8 mb-10">
//             {mockTicket.replies.map((reply) => (
//               <div key={reply.id} className="flex gap-4">
//                 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#E85A2A] text-white flex items-center justify-center font-bold shrink-0 shadow-lg border-2 border-white">
//                   {reply.avatar}
//                 </div>
//                 <div className="flex-1 space-y-2">
//                   <div className="flex items-baseline justify-between">
//                     <span className="font-bold text-gray-900">{reply.author}</span>
//                     <span className="text-xs text-gray-400 font-medium">{reply.date}</span>
//                   </div>
//                   <div className="p-5 bg-gray-50 rounded-2xl rounded-tl-none border border-gray-100 text-gray-700 text-[15px] leading-relaxed">
//                     {reply.content}
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>

//           {/* Reply Section */}
//           <div className="pt-8 border-t border-gray-100 space-y-4">
//             <textarea
//               placeholder="Type your message here..."
//               rows={4}
//               className="w-full p-5 text-gray-700 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-50 focus:border-[#FF6B35] outline-none transition-all resize-none"
//             />
//             <div className="flex justify-end">
//               <button className="flex items-center gap-2 px-8 py-3 font-bold text-white transition-all rounded-xl bg-[#FF6B35] hover:bg-[#E85A2A] shadow-lg shadow-orange-100 active:scale-95">
//                 <Send size={18} />
//                 Send Reply
//               </button>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//     </>
//   );
// }

