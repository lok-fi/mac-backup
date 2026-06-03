import { createSlice } from "@reduxjs/toolkit";


const mockTickets = [
  {
    id: '2024-001',
    subject: 'Air123 conditioning not working properly in unit 5B',
    description: 'The AC unit has been making strange noises and not cooling properly for the past 3 days. The temperature is consistently higher than the set point, and there seems to be reduced airflow from the vents. This is causing discomfort to the residents, especially during the afternoon hours.',
    status: 'open',
    priority: 'high',
    project: 'skyi-songbirds',
    category: 'Maintenance',
    createdDate: '04/02/2026',
    attachmentCount: 0,
    replies: [
      {
        id: "m1",
        author: "User",
        avatar: "U",
        content: "AC is not cooling",
        date: "04/02/2026 10:30 AM"
      }
    ]
  },
  {
    id: '2024-002',
    subject: 'Water leakage in bathroom needs immediate attention',
    description: 'This is causing discomfort to the residents, especially during the afternoon hours.',
    status: 'pending',
    priority: 'medium',
    project: 'Green Valley Complex',
    category: 'Plumbing',
    createdDate: '03/02/2026',
    attachmentCount: 1,
    replies: [
    {
      id: '1',
      author: 'Braj Bhushan',
      avatar: 'BB',
      content: 'Dear Pratiksha,\n\nThanks for the clarification.',
      date: '04:57 PM (1 hour ago)',
    },
    {
      id: '2',
      author: 'Braj Bhushan',
      avatar: 'BB',
      content: 'Dear Vignesh,\n\nOnce the work is done and confirm by Fristine team, user need to change password. So guide the user accordingly.\n\nThanks & Regards,\nBraj Bhushan Kumar\nAssistant Director - IT',
      date: '05/02/2026, 9:15 AM',
    },
  ],
  },
  {
    id: '2024-003',
    subject: 'Power outage in common area - resolved',
    description: 'The AC unit has been making strange noises and not cooling properly for the past 3 days.',
    status: 'closed',
    priority: 'low',
    project: 'Ocean View Residency',
    category: 'Electrical',
    createdDate: '01/02/2026',
    attachmentCount: 2,
    replies: [
    {
      id: '1',
      author: 'Braj Bhushan',
      avatar: 'BB',
      content: 'Dear Pratiksha,\n\nThanks for the clarification.',
      date: '04:57 PM (1 hour ago)',
    },
    {
      id: '2',
      author: 'Braj Bhushan',
      avatar: 'BB',
      content: 'Dear Vignesh,\n\nOnce the work is done and confirm by Fristine team, user need to change password. So guide the user accordingly.\n\nThanks & Regards,\nBraj Bhushan Kumar\nAssistant Director - IT',
      date: '05/02/2026, 9:15 AM',
    },
  ],
  },
  {
    id: '2024-004',
    subject: 'CCTV camera malfunction at entrance gate',
    description: 'Test',
    status: 'open',
    priority: 'high',
    project: 'Downtown Plaza',
    category: 'Security',
    createdDate: '31/01/2026',
    attachmentCount: 3,
    replies: [
    {
      id: '1',
      author: 'Braj Bhushan',
      avatar: 'BB',
      content: 'Dear Pratiksha,\n\nThanks for the clarification.',
      date: '04:57 PM (1 hour ago)',
    },
    {
      id: '2',
      author: 'Braj Bhushan',
      avatar: 'BB',
      content: 'Dear Vignesh,\n\nOnce the work is done and confirm by Fristine team, user need to change password. So guide the user accordingly.\n\nThanks & Regards,\nBraj Bhushan Kumar\nAssistant Director - IT',
      date: '05/02/2026, 9:15 AM',
    },
  ],
  },
  {
    id: '2024-005',
    subject: 'Request for deep cleaning service in lobby',
    description: '',
    status: 'rejected',
    priority: 'low',
    project: 'Hillside Villas',
    category: 'Cleaning',
    createdDate: '30/01/2026',
    attachmentCount: 0,
    replies: [
    {
      id: '1',
      author: 'Braj Bhushan',
      avatar: 'BB',
      content: 'Dear Pratiksha,\n\nThanks for the clarification.',
      date: '04:57 PM (1 hour ago)',
    },
    {
      id: '2',
      author: 'Braj Bhushan',
      avatar: 'BB',
      content: 'Dear Vignesh,\n\nOnce the work is done and confirm by Fristine team, user need to change password. So guide the user accordingly.\n\nThanks & Regards,\nBraj Bhushan Kumar\nAssistant Director - IT',
      date: '05/02/2026, 9:15 AM',
    },
  ],
  },
];

const ticketsSlice = createSlice({
  name: "tickets",
  initialState: {
    tickets: mockTickets,
    selectedTicket: null
  },
  reducers: {

    // 1️⃣ Load ticket list (static / API later)
    setTickets(state, action) {
      state.tickets = action.payload;
    },

    // 2️⃣ Select ticket for detail page
    selectTicketById(state, action) {
      state.selectedTicket =
        state.tickets.find(t => t.id === action.payload) || null;
    },

    // 3️⃣ Create new ticket
    createTicket(state, action) {
      state.tickets.unshift(action.payload);
    },

    // 4️⃣ Add message to ticket thread
    addMessageToTicket(state, action) {
      const { ticketId, message } = action.payload;
      const ticket = state.tickets.find(t => t.id === ticketId);
      if (ticket) {
        ticket.replies.push({
          ...message,
          id: Date.now().toString()
        });
      }
    }
  }
});

export const {
  setTickets,
  selectTicketById,
  createTicket,
  addMessageToTicket
} = ticketsSlice.actions;

export default ticketsSlice.reducer;
