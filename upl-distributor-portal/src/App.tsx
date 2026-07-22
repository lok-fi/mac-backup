/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  CheckSquare,
  User,
  Bell,
  Search,
  ChevronDown,
  Plus,
  Trash2,
  X,
  ArrowRight,
  Package,
  Calendar,
  MapPin,
  CircleCheck,
  Clock,
  AlertCircle,
  Truck,
  Upload,
  FileUp,
  Activity,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LoginPage from './LoginPage';

type Tab = 'dashboard' | 'orders' | 'invoices' | 'grn' | 'profile' | 'privacy' | 'terms';

const CREDIT_LIMIT = 5000;
const AVAILABLE_CREDIT = 4500;

interface LineItem {
  id: string;
  productName: string;
  sku: string;
  technicalName: string;
  quantity: number;
  billingPrice: number;
  discountPrice: number;
}

interface Order {
  id: string;
  distributorName: string;
  email: string;
  orderType: string;
  territory: string;
  description: string;
  orderDate: string;
  contactName: string;
  contactNumber: string;
  dueDate: string;
  creditBalance: string;
  plant: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Draft';
  billingAddress: Address;
  shippingAddress: Address;
  isShippingSameAsBilling: boolean;
  items: LineItem[];
  subtotal: number;
  grandTotal: number;
  epodSubmitted?: boolean;
  trackingStages: TrackingStage[];
  currentStageIndex: number;
}

interface TrackingStage {
  label: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string;
  location?: string;
  isStepAtDoorstep?: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  sapId: string;
  invoiceDate: string;
  distributorName: string;
  status: 'Approved' | 'Pending' | 'Paid';
  grandTotal: number;
  orderId: string;
}

interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
}

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-2026-001',
    distributorName: 'Lok',
    email: 'lok@upl-fi.com',
    orderType: 'Standard Bulk',
    territory: 'Maharashtra Rural',
    description: 'Pre-monsoon fertilizer stock up',
    orderDate: '2026-05-01',
    contactName: 'Lok',
    contactNumber: '+91 98765 43210',
    dueDate: '2026-05-20',
    creditBalance: '$4,50,000',
    plant: 'Vapi - Plant 1',
    status: 'Delivered',
    billingAddress: { street: 'Main Arcade, Block B', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400001' },
    shippingAddress: { street: 'Main Arcade, Block B', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400001' },
    isShippingSameAsBilling: true,
    items: [
      { id: '1', productName: 'PHOSKILL 50% EC', sku: 'UPL-INS-001', technicalName: 'Monocrotophos', quantity: 200, billingPrice: 450, discountPrice: 22.5 },
      { id: '2', productName: 'MANZATE MAX', sku: 'UPL-FUN-002', technicalName: 'Mancozeb', quantity: 150, billingPrice: 320, discountPrice: 16 }
    ],
    subtotal: 125000,
    grandTotal: 147500,
    trackingStages: [
      { label: 'Order Confirmed', status: 'completed', timestamp: '2026-05-01 10:00 AM', location: 'System' },
      { label: 'Processing', status: 'completed', timestamp: '2026-05-01 02:30 PM', location: 'Vapi Plant' },
      { label: 'Shipped', status: 'completed', timestamp: '2026-05-02 09:15 AM', location: 'Vapi Dispatch' },
      { label: 'Out for Delivery', status: 'completed', timestamp: '2026-05-05 08:30 AM', location: 'Main Hub' },
      { label: 'Delivered', status: 'completed', timestamp: '2026-05-05 04:45 PM', location: 'Delivery Point', isStepAtDoorstep: true }
    ],
    currentStageIndex: 4
  },
  {
    id: 'ORD-2026-002',
    distributorName: 'Lok',
    email: 'lok@upl-fi.com',
    orderType: 'Urgent Pesticide',
    territory: 'Gujarat North',
    description: 'Emergency pest control supply',
    orderDate: '2026-05-08',
    contactName: 'Lok',
    contactNumber: '+91 98765 43210',
    dueDate: '2026-05-15',
    creditBalance: '$4,50,000',
    plant: 'Ankleshwar',
    status: 'Shipped',
    billingAddress: { street: 'Main Arcade, Block B', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400001' },
    shippingAddress: { street: 'Gujarat Warehouse 4', city: 'Surat', state: 'Gujarat', country: 'India', zipCode: '395003' },
    isShippingSameAsBilling: false,
    items: [
      { id: '1', productName: 'ULALA', sku: 'UPL-INS-004', technicalName: 'Flonicamid', quantity: 80, billingPrice: 1250, discountPrice: 62.5 }
    ],
    subtotal: 84000,
    grandTotal: 99120,
    trackingStages: [
      { label: 'Order Confirmed', status: 'completed', timestamp: '2026-05-08 11:30 AM', location: 'System' },
      { label: 'Processing', status: 'completed', timestamp: '2026-05-08 03:00 PM', location: 'Ankleshwar Plant' },
      { label: 'Shipped', status: 'completed', timestamp: '2026-05-09 10:00 AM', location: 'Dispatch Yard' },
      { label: 'At Doorstep', status: 'current', timestamp: '2026-05-11 09:00 AM', location: 'Final Delivery Zone', isStepAtDoorstep: true },
      { label: 'Delivered', status: 'pending' }
    ],
    currentStageIndex: 3
  }
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: '3413350000002437166',
    invoiceNumber: 'INV-6078-1',
    sapId: '4511590003',
    invoiceDate: '2026-05-08',
    distributorName: 'Lok',
    status: 'Approved',
    grandTotal: 147500,
    orderId: 'ORD-2026-001'
  },
  {
    id: '3413350000002399004',
    invoiceNumber: 'INV-6078-2',
    sapId: '4501500021',
    invoiceDate: '2026-05-05',
    distributorName: 'Lok',
    status: 'Approved',
    grandTotal: 99120,
    orderId: 'ORD-2026-002'
  }
];

interface Product {
  name: string;
  sku: string;
  technicalName: string;
  basePrice: number;
}

const PREDEFINED_PRODUCTS: Product[] = [
  { name: 'PHOSKILL 50% EC', sku: 'UPL-INS-001', technicalName: 'Monocrotophos', basePrice: 450 },
  { name: 'MANZATE MAX', sku: 'UPL-FUN-002', technicalName: 'Mancozeb', basePrice: 320 },
  { name: 'GLYPHOSATE 41% SL', sku: 'UPL-HER-003', technicalName: 'Glyphosate', basePrice: 280 },
  { name: 'ULALA', sku: 'UPL-INS-004', technicalName: 'Flonicamid', basePrice: 1250 },
  { name: 'SAAF', sku: 'UPL-FUN-005', technicalName: 'Carbendazim + Mancozeb', basePrice: 580 },
  { name: 'MACARENA', sku: 'UPL-FUN-006', technicalName: 'Azoxystrobin + Pyraclostrobin', basePrice: 1850 },
  { name: 'LANCER GOLD', sku: 'UPL-INS-007', technicalName: 'Acephate + Imidacloprid', basePrice: 940 },
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string | null>(INITIAL_ORDERS.find(o => o.status === 'Shipped')?.id || null);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [liveAlerts] = useState([
    { id: '1', type: 'info', message: 'New monsoon promotion starts next week!', date: 'Just now' },
    { id: '2', type: 'warning', message: 'Vapi plant running at 110% capacity - expect faster delivery.', date: '2 hours ago' },
    { id: '3', type: 'success', message: 'Your payment for INV-6088 has been verified.', date: '5 hours ago' },
  ]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileAddresses, setProfileAddresses] = useState({
    billingAddress: { street: '', city: '', state: '', country: '', zipCode: '' } as Address,
    shippingAddress: { street: '', city: '', state: '', country: '', zipCode: '' } as Address,
    sameAsBilling: true,
  });
  const [addressSaved, setAddressSaved] = useState(false);

  // Clear highlight after 3 seconds
  useEffect(() => {
    if (highlightedOrderId) {
      const timer = setTimeout(() => {
        setHighlightedOrderId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedOrderId]);

  // Keyboard shortcuts: Cmd/Ctrl+K to open search, ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(v => !v);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Form State
  const [formData, setFormData] = useState<Partial<Order>>({
    distributorName: 'Lok',
    email: 'lok@upl-fi.com',
    orderDate: new Date().toISOString().split('T')[0],
    isShippingSameAsBilling: true,
    billingAddress: { street: '', city: '', state: '', country: '', zipCode: '' },
    shippingAddress: { street: '', city: '', state: '', country: '', zipCode: '' },
    items: [{ id: '1', productName: '', sku: '', technicalName: '', quantity: 1, billingPrice: 0, discountPrice: 0 }]
  });

  const calculateTotals = (items: LineItem[]) => {
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * (item.billingPrice - item.discountPrice)), 0);
    const cgst = subtotal * 0.09;
    const sgst = subtotal * 0.09;
    const igst = subtotal * 0.13; // Example IGST
    const tax = cgst + sgst;
    const total = subtotal + tax;
    return { subtotal, tax, total, cgst, sgst, igst };
  };

  const handleEpodUpload = (orderId: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newStages = [...order.trackingStages];
        // Mark current as completed
        if (newStages[order.currentStageIndex]) {
          newStages[order.currentStageIndex].status = 'completed';
          newStages[order.currentStageIndex].timestamp = new Date().toLocaleString();
        }
        // Move to next stage (Delivered)
        const nextIndex = order.currentStageIndex + 1;
        if (newStages[nextIndex]) {
          newStages[nextIndex].status = 'completed';
          newStages[nextIndex].timestamp = new Date().toLocaleString();
          newStages[nextIndex].location = 'Your Warehouse';
        }

        return {
          ...order,
          status: 'Delivered',
          epodSubmitted: true,
          currentStageIndex: nextIndex,
          trackingStages: newStages
        };
      }
      return order;
    }));
  };

  const totals = useMemo(() => calculateTotals((formData.items || []) as LineItem[]), [formData.items]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    // Initialize data for last 6 months
    const data: Record<string, { month: string, total: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = months[d.getMonth()];
      data[m] = { month: m, total: 0 };
    }

    orders.forEach(order => {
      const date = new Date(order.orderDate);
      const m = months[date.getMonth()];
      if (data[m]) {
        data[m].total += order.grandTotal;
      }
    });

    return Object.values(data);
  }, [orders]);

  const salesData = useMemo(() => {
    const aggregated: Record<string, {
      productName: string;
      sku: string;
      technicalName: string;
      totalQuantity: number;
      totalAmount: number;
      totalDiscount: number;
      orders: string[];
    }> = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        if (!aggregated[item.sku]) {
          aggregated[item.sku] = {
            productName: item.productName,
            sku: item.sku,
            technicalName: item.technicalName,
            totalQuantity: 0,
            totalAmount: 0,
            totalDiscount: 0,
            orders: []
          };
        }
        aggregated[item.sku].totalQuantity += item.quantity;
        aggregated[item.sku].totalAmount += (item.billingPrice - item.discountPrice) * item.quantity;
        aggregated[item.sku].totalDiscount += item.discountPrice * item.quantity;
        if (!aggregated[item.sku].orders.includes(order.id)) {
          aggregated[item.sku].orders.push(order.id);
        }
      });
    });

    return Object.values(aggregated);
  }, [orders]);

  const currentAvailableCredit = useMemo(() => {
    const pendingAmount = orders.reduce((acc, o) => o.status === 'Pending' ? acc + o.grandTotal : acc, 0);
    return AVAILABLE_CREDIT - pendingAmount;
  }, [orders]);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (totals.total > currentAvailableCredit) {
      alert("Error: Order total exceeds available credit limit. Please reduce quantity or settle pending invoices.");
      return;
    }
    const orderId = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const newOrder: Order = {
      ...formData as Order,
      id: orderId,
      status: 'Pending',
      subtotal: totals.subtotal,
      grandTotal: totals.total,
      currentStageIndex: 0,
      trackingStages: [
        { label: 'Order Confirmed', status: 'current', timestamp: new Date().toLocaleString(), location: 'System' },
        { label: 'Processing', status: 'pending' },
        { label: 'Shipped', status: 'pending' },
        { label: 'At Doorstep', status: 'pending', isStepAtDoorstep: true },
        { label: 'Delivered', status: 'pending' }
      ]
    };

    const newInvoice: Invoice = {
      id: Math.random().toString(10).slice(2, 21),
      invoiceNumber: `INV-${Math.floor(Math.random() * 10000)}-${Math.floor(Math.random() * 10)}`,
      sapId: `4501${Math.floor(Math.random() * 100000)}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      distributorName: formData.distributorName || 'Lok',
      status: 'Pending',
      grandTotal: totals.total,
      orderId: orderId
    };

    setOrders([newOrder, ...orders]);
    setInvoices([newInvoice, ...invoices]);
    setIsAddingOrder(false);
  };

  const handleSaveProfileAddress = () => {
    setAddressSaved(true);
    setTimeout(() => setAddressSaved(false), 2500);
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { orders: [] as Order[], invoices: [] as Invoice[] };
    return {
      orders: orders.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.orderType.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q) ||
        o.plant.toLowerCase().includes(q) ||
        (o.territory && o.territory.toLowerCase().includes(q))
      ),
      invoices: invoices.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.sapId.toLowerCase().includes(q) ||
        inv.status.toLowerCase().includes(q)
      ),
    };
  }, [searchQuery, orders, invoices]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'grn', label: 'GRN', icon: CheckSquare },
  ];

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center">
              <video
                src="https://www.upl-ltd.com/images/UPL_header-logo.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="h-14 w-auto object-contain"
              />
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`
                      relative px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-2
                      ${isActive
                        ? 'text-upl-blue bg-blue-50'
                        : 'text-slate-500 hover:text-upl-blue hover:bg-slate-50'}
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-upl-orange' : ''}`} />
                    {tab.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-upl-orange rounded-full"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-400 hover:text-upl-blue hover:border-upl-blue/30 hover:bg-blue-50/50 transition-all text-xs font-semibold"
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden md:block text-slate-400">Search…</span>
                  <kbd className="hidden lg:block px-1.5 py-0.5 text-[9px] font-black bg-slate-100 border border-slate-200 rounded text-slate-400">⌘K</kbd>
                </button>
                <button className="p-2 text-slate-400 hover:text-upl-blue transition-colors relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-upl-orange rounded-full border-2 border-white" />
                </button>
              </div>

              <div className="h-8 w-[1px] bg-slate-200 mx-1" />

              <button
                onClick={() => setActiveTab('profile')}
                className={`
                  flex items-center gap-3 p-1 pl-3 rounded-full border transition-all
                  ${activeTab === 'profile'
                    ? 'border-upl-blue bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'}
                `}
              >
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-black text-upl-blue uppercase tracking-widest leading-none">Lok</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-upl-blue">
                  <User className="w-6 h-6" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 md:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="flex flex-col gap-2">
                  <h1 className="text-3xl font-bold text-upl-blue">Dashboard Overview</h1>
                  <p className="text-slate-500">Welcome back, Lok. Here's a snapshot of your distribution network's performance.</p>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      label: 'Total Orders', value: orders.length.toString(),
                      icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50',
                      accent: 'bg-blue-500',
                      trend: `${orders.filter(o => o.status === 'Delivered').length} delivered`,
                      trendColor: 'text-emerald-500',
                    },
                    {
                      label: 'Pending GRN', value: '12',
                      icon: CheckSquare, color: 'text-amber-600', bg: 'bg-amber-50',
                      accent: 'bg-amber-500',
                      trend: '3 require attention',
                      trendColor: 'text-amber-500',
                    },
                    {
                      label: 'Credit Balance', value: `$${CREDIT_LIMIT.toLocaleString()}`,
                      icon: FileText, color: 'text-upl-blue', bg: 'bg-blue-50',
                      accent: 'bg-upl-blue',
                      trend: 'Annual allocation',
                      trendColor: 'text-slate-400',
                    },
                    {
                      label: 'Available Credit Limit',
                      value: `$${(AVAILABLE_CREDIT - orders.reduce((acc, o) => o.status === 'Pending' ? acc + o.grandTotal : acc, 0)).toLocaleString()}`,
                      icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50',
                      accent: 'bg-red-500',
                      trend: 'of $5,000 limit',
                      trendColor: 'text-slate-400',
                    },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' }}
                      whileHover={{ y: -5, scale: 1.02, transition: { duration: 0.18 } }}
                      whileTap={{ scale: 0.97 }}
                      className="relative bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/70 hover:border-slate-300 flex items-center gap-4 cursor-default overflow-hidden group transition-shadow duration-300"
                    >
                      {/* Colored top-bar that slides in on hover */}
                      <div className={`absolute top-0 inset-x-0 h-[3px] ${stat.accent} rounded-t-3xl origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500`} />
                      {/* Subtle glow blob behind icon */}
                      <div className={`absolute -left-4 -top-4 w-20 h-20 rounded-full ${stat.bg} opacity-0 group-hover:opacity-60 blur-2xl transition-opacity duration-500`} />

                      <div className={`relative w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-md`}>
                        <stat.icon className="w-6 h-6 transition-transform duration-300 group-hover:-rotate-12" />
                      </div>
                      <div className="relative">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                        <p className="text-xl font-black text-upl-blue leading-tight">{stat.value}</p>
                        <p className={`text-[10px] font-semibold mt-0.5 ${stat.trendColor}`}>{stat.trend}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Recent Orders Widget */}
                  <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-upl-blue flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Recent Orders
                      </h3>
                      <button onClick={() => setActiveTab('orders')} className="text-xs font-bold text-upl-orange hover:underline uppercase tracking-widest">View All</button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {orders.slice(0, 4).map((order) => (
                        <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                              <Package className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-upl-blue">{order.id}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{order.orderDate} • {order.plant}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">${order.grandTotal.toLocaleString()}</p>
                            <span className={`text-[10px] font-bold ${order.status === 'Delivered' ? 'text-emerald-500' : 'text-amber-500'}`}>{order.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Notifications & Live Alerts */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <h3 className="font-bold text-upl-blue flex items-center gap-2 border-b border-slate-100 pb-4">
                      <Bell className="w-5 h-5 text-upl-orange" />
                      Live Network Alerts
                    </h3>
                    <div className="space-y-4">
                      {liveAlerts.map((alert) => (
                        <div key={alert.id} className={`p-4 rounded-2xl border flex gap-3 ${alert.type === 'warning' ? 'bg-amber-50 border-amber-100' :
                            alert.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                              'bg-blue-50 border-blue-100'
                          }`}>
                          <div className={`p-2 rounded-xl bg-white shadow-sm flex-shrink-0`}>
                            {alert.type === 'warning' ? <AlertCircle className="w-4 h-4 text-amber-500" /> :
                              alert.type === 'success' ? <CircleCheck className="w-4 h-4 text-emerald-500" /> :
                                <Activity className="w-4 h-4 text-blue-500" />}
                          </div>
                          <div>
                            <p className={`text-xs font-bold ${alert.type === 'warning' ? 'text-amber-700' :
                                alert.type === 'success' ? 'text-emerald-700' :
                                  'text-blue-700'
                              }`}>{alert.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{alert.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Visual Chart Placeholder */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-8 overflow-hidden relative group">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-xl font-black text-upl-blue italic uppercase tracking-tighter">Monthly Performance</h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">Transaction volume across the digital network</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <ArrowRight className="w-3 h-3 -rotate-45" />
                        +12.4% vs Prev
                      </div>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#002855" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#002855" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#002855',
                            borderRadius: '16px',
                            border: 'none',
                            color: '#fff',
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                          }}
                          itemStyle={{ color: '#fff', fontWeight: 900 }}
                          labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Volume']}
                        />
                        <Area
                          type="monotone"
                          dataKey="total"
                          stroke="#002855"
                          strokeWidth={4}
                          fillOpacity={1}
                          fill="url(#colorTotal)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Sales Overview Integration */}
                <div className="space-y-8 pt-8 border-t border-slate-200">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-black text-upl-blue italic uppercase tracking-tighter">Life-time Sales Analytics</h2>
                    <p className="text-slate-500 text-sm">Historical performance and product-level purchasing data log.</p>
                  </div>

                  <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-black text-upl-blue uppercase tracking-widest text-sm italic">Product-Level Order History</h3>
                      <div className="flex items-center gap-2 group">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Integration Sync</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-8 py-5">Product Details</th>
                            <th className="px-8 py-5 text-center">Lifetime Qty</th>
                            <th className="px-8 py-5">Avg Discount</th>
                            <th className="px-8 py-5">Associated Orders</th>
                            <th className="px-8 py-5 text-right">Total Invested</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {salesData.map((item) => (
                            <tr key={item.sku} className="hover:bg-slate-50/40 transition-colors">
                              <td className="px-8 py-6">
                                <p className="font-black text-upl-blue">{item.productName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{item.sku}</span>
                                  <span className="text-[10px] text-slate-400 italic">| {item.technicalName}</span>
                                </div>
                              </td>
                              <td className="px-8 py-6 text-center">
                                <span className="px-4 py-2 bg-blue-50 text-upl-blue rounded-2xl font-black text-sm">
                                  {item.totalQuantity}
                                </span>
                              </td>
                              <td className="px-8 py-6 font-bold text-emerald-600">
                                ${(item.totalDiscount / item.totalQuantity).toFixed(2)}/u
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex flex-wrap gap-1">
                                  {item.orders.map(oid => (
                                    <span key={oid} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                      {oid}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-8 py-6 text-right">
                                <p className="text-lg font-black text-slate-900">${item.totalAmount.toLocaleString()}</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-6">
                <AnimatePresence mode="wait">
                  {!isAddingOrder ? (
                    <motion.div
                      key="order-list"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                        <div className="flex flex-col gap-2">
                          <h1 className="text-3xl font-bold text-upl-blue">Orders Management</h1>
                          <p className="text-slate-500">Track, manage and place new orders for products.</p>
                        </div>
                        <button
                          onClick={() => {
                            const hasBilling = profileAddresses.billingAddress.street.trim() !== '';
                            setFormData({
                              distributorName: 'Lok',
                              email: 'lok@upl-fi.com',
                              orderDate: new Date().toISOString().split('T')[0],
                              isShippingSameAsBilling: hasBilling ? profileAddresses.sameAsBilling : true,
                              billingAddress: hasBilling
                                ? { ...profileAddresses.billingAddress }
                                : { street: '', city: '', state: '', country: '', zipCode: '' },
                              shippingAddress: hasBilling
                                ? (profileAddresses.sameAsBilling
                                  ? { ...profileAddresses.billingAddress }
                                  : { ...profileAddresses.shippingAddress })
                                : { street: '', city: '', state: '', country: '', zipCode: '' },
                              items: [{ id: '1', productName: '', sku: '', technicalName: '', quantity: 1, billingPrice: 0, discountPrice: 0 }]
                            });
                            setIsAddingOrder(true);
                          }}
                          className="bg-upl-orange text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-upl-orange/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                          <Plus className="w-5 h-5" />
                          Add Order
                        </button>
                      </div>

                      {/* Orders Table */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order ID</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product Type</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {orders.map((order) => {
                                const isHighlighted = highlightedOrderId === order.id;
                                return (
                                  <motion.tr
                                    key={order.id}
                                    initial={false}
                                    animate={isHighlighted ? {
                                      backgroundColor: ['rgba(255,255,255,1)', 'rgba(255,130,0,0.1)', 'rgba(255,255,255,1)'],
                                      boxShadow: ['none', 'inset 0 0 20px rgba(255,130,0,0.1)', 'none']
                                    } : {}}
                                    transition={{ duration: 1.5, repeat: isHighlighted ? 2 : 0 }}
                                    className={`hover:bg-slate-50/50 transition-colors group ${isHighlighted ? 'ring-2 ring-upl-orange ring-inset relative z-10' : ''}`}
                                  >
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isHighlighted ? 'bg-upl-orange text-white' : 'bg-blue-50 text-upl-blue'}`}>
                                          <ShoppingBag className="w-4 h-4" />
                                        </div>
                                        <span className={`font-bold transition-colors ${isHighlighted ? 'text-upl-orange' : 'text-upl-blue'}`}>{order.id}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-600">{order.orderDate}</td>
                                    <td className="px-6 py-4 text-slate-600">{order.orderType}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900">${order.grandTotal.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                      <span className={`
                                        inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                                        ${order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600' : ''}
                                        ${order.status === 'Shipped' ? 'bg-blue-50 text-blue-600' : ''}
                                        ${order.status === 'Pending' ? 'bg-amber-50 text-amber-600' : ''}
                                      `}>
                                        {order.status === 'Delivered' && <CircleCheck className="w-3 h-3" />}
                                        {order.status === 'Shipped' && <Package className="w-3 h-3" />}
                                        {order.status === 'Pending' && <Clock className="w-3 h-3" />}
                                        {order.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <button
                                        onClick={() => setSelectedOrder(order)}
                                        className="text-upl-blue p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                      >
                                        <ArrowRight className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </motion.tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {orders.length === 0 && (
                          <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                            <ShoppingBag className="w-16 h-16 mb-4 opacity-10" />
                            <p className="text-lg font-medium">No orders found.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="order-form"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="max-w-5xl mx-auto"
                    >
                      <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <button
                          onClick={() => setIsAddingOrder(false)}
                          className="group flex items-center gap-2 text-slate-500 hover:text-upl-blue font-bold px-3 sm:px-4 py-2 rounded-xl transition-all"
                        >
                          <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                          Cancel
                        </button>
                        <h2 className="text-lg sm:text-2xl font-black text-upl-blue">New Order Creation</h2>
                        <div className="w-16 sm:w-20" />
                      </div>

                      <form onSubmit={handleCreateOrder} className="space-y-6 pb-20">
                        {/* Section: Basic Details */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-8 space-y-6">
                          <div className="flex items-center gap-3 text-upl-blue pb-4 border-b border-slate-100">
                            <LayoutDashboard className="w-6 h-6 border-2 border-upl-blue rounded-lg p-0.5" />
                            <h3 className="font-bold text-lg">Basic Details</h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[
                              { label: 'Distributor Name', value: formData.distributorName, readOnly: true },
                              { label: 'Email', value: formData.email, readOnly: true },
                              { label: 'Order Type', key: 'orderType', type: 'select', options: ['Standard', 'Urgent', 'Bulk', 'Promotion'] },
                              { label: 'Territory', key: 'territory', placeholder: 'e.g. Rajasthan North' },
                              { label: 'Order Date', key: 'orderDate', type: 'date' },
                              { label: 'Contact Name', key: 'contactName' },
                              { label: 'Contact Number', key: 'contactNumber' },
                              { label: 'Due Date', key: 'dueDate', type: 'date' },
                              { label: 'Credit Balance', key: 'creditBalance', placeholder: 'e.g. $5,00,000' },
                              { label: 'Plant', key: 'plant', placeholder: 'e.g. Jaipur Plant' },
                            ].map((field) => (
                              <div key={field.label} className="space-y-1.5 focus-within:ring-2 focus-within:ring-upl-blue/5 rounded-xl transition-all">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">{field.label}</label>
                                {field.type === 'select' ? (
                                  <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-upl-blue focus:bg-white transition-all appearance-none"
                                    value={(formData as any)[field.key!]}
                                    onChange={(e) => setFormData({ ...formData, [field.key!]: e.target.value })}
                                  >
                                    <option value="">Select Type</option>
                                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                ) : (
                                  <input
                                    type={field.type || 'text'}
                                    readOnly={field.readOnly}
                                    placeholder={field.placeholder}
                                    className={`w-full ${field.readOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50'} border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-upl-blue focus:bg-white transition-all`}
                                    value={(field.key ? (formData as any)[field.key] : field.value) || ''}
                                    onChange={(e) => field.key && setFormData({ ...formData, [field.key]: e.target.value })}
                                  />
                                )}
                              </div>
                            ))}
                            <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Order Description</label>
                              <textarea
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-upl-blue focus:bg-white transition-all h-24"
                                placeholder="Enter specific instructions or order notes..."
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section: Billing & Shipping */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-8 space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
                            <div className="flex items-center gap-3 text-upl-blue">
                              <MapPin className="w-6 h-6 border-2 border-upl-blue rounded-lg p-0.5" />
                              <h3 className="font-bold text-sm sm:text-lg">Billing & Shipping Address</h3>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={formData.isShippingSameAsBilling}
                                onChange={(e) => {
                                  const same = e.target.checked;
                                  setFormData({
                                    ...formData,
                                    isShippingSameAsBilling: same,
                                    shippingAddress: same ? { ...formData.billingAddress! } : formData.shippingAddress
                                  });
                                }}
                                className="w-5 h-5 rounded border-slate-300 text-upl-orange focus:ring-upl-orange cursor-pointer"
                              />
                              <span className="text-sm font-bold text-slate-500 group-hover:text-upl-blue transition-colors">Same as Billing</span>
                            </label>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* Billing */}
                            <div className="space-y-4">
                              <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest border-l-4 border-upl-blue pl-3">Billing Address</h4>
                              <div className="space-y-4">
                                {['street', 'city', 'state', 'country', 'zipCode'].map((key) => (
                                  <div key={`billing-${key}`}>
                                    <input
                                      placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-upl-blue focus:bg-white"
                                      value={(formData.billingAddress as any)[key]}
                                      onChange={(e) => {
                                        const newBilling = { ...formData.billingAddress!, [key]: e.target.value };
                                        setFormData({
                                          ...formData,
                                          billingAddress: newBilling,
                                          shippingAddress: formData.isShippingSameAsBilling ? newBilling : formData.shippingAddress
                                        });
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Shipping */}
                            <div className={`space-y-4 transition-opacity duration-300 ${formData.isShippingSameAsBilling ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                              <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest border-l-4 border-upl-orange pl-3">Shipping Address</h4>
                              <div className="space-y-4">
                                {['street', 'city', 'state', 'country', 'zipCode'].map((key) => (
                                  <div key={`shipping-${key}`}>
                                    <input
                                      placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-upl-blue focus:bg-white"
                                      value={(formData.shippingAddress as any)[key]}
                                      onChange={(e) => setFormData({ ...formData, shippingAddress: { ...formData.shippingAddress!, [key]: e.target.value } })}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Section: Line Items */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="p-4 sm:p-8 pb-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3 text-upl-blue">
                              <CheckSquare className="w-6 h-6 border-2 border-upl-blue rounded-lg p-0.5" />
                              <h3 className="font-bold text-lg">Line Items*</h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                items: [...(formData.items || []), { id: Date.now().toString(), productName: '', sku: '', technicalName: '', quantity: 1, billingPrice: 0, discountPrice: 0 }]
                              })}
                              className="text-upl-blue hover:text-white hover:bg-upl-blue px-4 py-2 rounded-xl text-sm font-bold border-2 border-upl-blue transition-all flex items-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Add New
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-[10px] font-black text-slate-400 border-b border-slate-100 uppercase tracking-widest">
                                  <th className="px-6 py-4">Product Name*</th>
                                  <th className="px-6 py-4">SKU*</th>
                                  <th className="px-6 py-4">Technical Name</th>
                                  <th className="px-1 py-4 w-24">Qty*</th>
                                  <th className="px-6 py-4">Price*</th>
                                  <th className="px-6 py-4">Discount</th>
                                  <th className="px-6 py-4">Total</th>
                                  <th className="px-6 py-4 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {formData.items?.map((item, idx) => (
                                  <tr key={item.id} className="group">
                                    <td className="px-6 py-3">
                                      <select
                                        className="w-full bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:bg-white focus:border-upl-blue transition-all appearance-none"
                                        value={item.productName}
                                        onChange={(e) => {
                                          const selectedProd = PREDEFINED_PRODUCTS.find(p => p.name === e.target.value);
                                          const newItems = [...formData.items!];
                                          if (selectedProd) {
                                            newItems[idx] = {
                                              ...newItems[idx],
                                              productName: selectedProd.name,
                                              sku: selectedProd.sku,
                                              technicalName: selectedProd.technicalName,
                                              billingPrice: selectedProd.basePrice,
                                              discountPrice: Math.round(selectedProd.basePrice * 0.05), // Default 5% discount
                                            };
                                          } else {
                                            newItems[idx].productName = e.target.value;
                                          }
                                          setFormData({ ...formData, items: newItems });
                                        }}
                                      >
                                        <option value="">Select Product...</option>
                                        {PREDEFINED_PRODUCTS.map(p => (
                                          <option key={p.sku} value={p.name}>{p.name}</option>
                                        ))}
                                        <option value="custom">Other (Manual Entry)</option>
                                      </select>
                                    </td>
                                    <td className="px-6 py-3">
                                      <input
                                        className="w-full bg-slate-100 border border-transparent rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-500"
                                        value={item.sku}
                                        readOnly
                                        placeholder="SKU"
                                      />
                                    </td>
                                    <td className="px-6 py-3">
                                      <input
                                        className="w-full bg-slate-100 border border-transparent rounded-lg px-3 py-2 text-xs text-slate-500"
                                        value={item.technicalName}
                                        readOnly
                                        placeholder="Tech Name"
                                      />
                                    </td>
                                    <td className="px-1 py-3">
                                      <input
                                        type="number"
                                        className="w-20 bg-slate-50 border border-transparent rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:bg-white transition-all"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const newItems = [...formData.items!];
                                          newItems[idx].quantity = parseInt(e.target.value) || 0;
                                          setFormData({ ...formData, items: newItems });
                                        }}
                                      />
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">$</span>
                                        <input
                                          type="number"
                                          className="w-full pl-6 bg-slate-50 border border-transparent rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:bg-white transition-all"
                                          value={item.billingPrice}
                                          onChange={(e) => {
                                            const newItems = [...formData.items!];
                                            newItems[idx].billingPrice = parseFloat(e.target.value) || 0;
                                            setFormData({ ...formData, items: newItems });
                                          }}
                                        />
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 text-red-500 font-bold">
                                      <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-300">$</span>
                                        <input
                                          type="number"
                                          className="w-full pl-6 bg-slate-50 border border-transparent rounded-lg px-3 py-2 text-sm font-bold text-red-500 focus:outline-none focus:bg-white transition-all"
                                          value={item.discountPrice}
                                          onChange={(e) => {
                                            const newItems = [...formData.items!];
                                            newItems[idx].discountPrice = parseFloat(e.target.value) || 0;
                                            setFormData({ ...formData, items: newItems });
                                          }}
                                        />
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 font-black text-slate-900">
                                      ${((item.billingPrice - item.discountPrice) * item.quantity).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newItems = formData.items!.filter((_, i) => i !== idx);
                                          setFormData({ ...formData, items: newItems.length ? newItems : [{ id: '1', productName: '', sku: '', technicalName: '', quantity: 1, billingPrice: 0, discountPrice: 0 }] });
                                        }}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="p-4 sm:p-8 bg-slate-50 flex flex-col items-end gap-4">
                            <div className="w-full sm:w-80 space-y-3">
                              <div className="flex justify-between text-sm font-bold text-slate-500">
                                <span>Subtotal</span>
                                <span className="text-slate-900">${totals.subtotal.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs font-semibold text-slate-400">
                                <span>CGST (9%)</span>
                                <span>${totals.cgst.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs font-semibold text-slate-400">
                                <span>SGST (9%)</span>
                                <span>${totals.sgst.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs font-semibold text-slate-400 pb-3 border-b border-slate-200">
                                <span>IGST (13%)</span>
                                <span>${totals.igst.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm font-bold text-upl-blue">
                                <span>Tax Amount</span>
                                <span>${totals.tax.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center text-xl font-black text-upl-blue pt-3">
                                <div className="flex flex-col">
                                  <span>Grand Total*</span>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Incl. Taxes</span>
                                </div>
                                <span className="text-2xl text-upl-orange">${totals.total.toLocaleString()}</span>
                              </div>
                            </div>

                            {totals.total > currentAvailableCredit && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-4 items-center w-full sm:w-80"
                              >
                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                                  <AlertCircle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-red-700">CREDIT LIMIT EXCEEDED</p>
                                  <p className="text-xs text-red-600/70">Your order total (${totals.total.toLocaleString()}) exceeds your available credit ($${currentAvailableCredit.toLocaleString()}). Submission blocked.</p>
                                </div>
                              </motion.div>
                            )}
                          </div>

                          <div className="p-4 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setIsAddingOrder(false)}
                              className="px-8 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-center"
                            >
                              Save as Draft
                            </button>
                            <button
                              type="submit"
                              disabled={totals.total > currentAvailableCredit}
                              className={`
                                px-6 sm:px-10 py-4 rounded-xl font-black text-white shadow-2xl transition-all flex items-center justify-center gap-3
                                ${totals.total > currentAvailableCredit
                                  ? 'bg-slate-300 cursor-not-allowed opacity-50'
                                  : 'bg-gradient-to-r from-upl-blue to-blue-800 shadow-blue-800/20 hover:scale-[1.02] active:scale-[0.98]'}
                              `}
                            >
                              <ShoppingBag className="w-5 h-5" />
                              CONFIRM & PLACE ORDER
                            </button>
                          </div>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Order Detail Modal */}
                <AnimatePresence>
                  {selectedOrder && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedOrder(null)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
                      >
                        {/* Modal Header */}
                        <div className="shrink-0 bg-gradient-to-r from-upl-orange to-orange-600 p-5 sm:p-8 flex justify-between items-start">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="bg-white/20 p-2 sm:p-3 rounded-2xl backdrop-blur-sm">
                              <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-black text-white">Order Details</h2>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 text-white`}>
                                  {selectedOrder.status}
                                </span>
                              </div>
                              <p className="text-orange-100/60 font-mono text-sm mt-1">{selectedOrder.id}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedOrder(null)}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>

                        {/* Modal Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-10 space-y-6 sm:space-y-10">
                          {/* Top Row: Quick Info */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                              { label: 'Order Date', value: selectedOrder.orderDate, icon: Calendar },
                              { label: 'Due Date', value: selectedOrder.dueDate || 'N/A', icon: Clock },
                              { label: 'Plant', value: selectedOrder.plant, icon: MapPin },
                              { label: 'Total Value', value: `$${selectedOrder.grandTotal.toLocaleString()}`, icon: AlertCircle },
                            ].map((stat) => (
                              <div key={stat.label} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                  <stat.icon className="w-3 h-3 text-upl-orange" />
                                  {stat.label}
                                </p>
                                <p className="text-sm font-black text-slate-900">{stat.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Addresses Section */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <h4 className="text-xs font-black text-upl-orange uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-upl-orange" />
                                Billing Information
                              </h4>
                              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-1">
                                <p className="text-sm font-bold text-slate-800">{selectedOrder.billingAddress.street}</p>
                                <p className="text-sm text-slate-500">
                                  {selectedOrder.billingAddress.city}, {selectedOrder.billingAddress.state}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {selectedOrder.billingAddress.country} - {selectedOrder.billingAddress.zipCode}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <h4 className="text-xs font-black text-upl-orange uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-upl-orange" />
                                Shipping Information
                              </h4>
                              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-1">
                                {selectedOrder.isShippingSameAsBilling ? (
                                  <p className="text-sm font-bold text-slate-400 italic">Same as billing address</p>
                                ) : (
                                  <>
                                    <p className="text-sm font-bold text-slate-800">{selectedOrder.shippingAddress.street}</p>
                                    <p className="text-sm text-slate-500">
                                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                      {selectedOrder.shippingAddress.country} - {selectedOrder.shippingAddress.zipCode}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Items Section */}
                          <div className="space-y-4">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Order Line Items
                            </h4>
                            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50/50">
                                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <th className="px-6 py-4">Product Details</th>
                                    <th className="px-6 py-4 text-center">Quantity</th>
                                    <th className="px-6 py-4">Unit Price</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {selectedOrder.items.length > 0 ? selectedOrder.items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-upl-orange">{item.productName}</p>
                                        <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{item.sku}</p>
                                      </td>
                                      <td className="px-6 py-4 text-center font-bold text-slate-600">{item.quantity}</td>
                                      <td className="px-6 py-4 font-semibold text-slate-900">${item.billingPrice.toLocaleString()}</td>
                                      <td className="px-6 py-4 text-right font-black text-slate-950">${((item.billingPrice - item.discountPrice) * item.quantity).toLocaleString()}</td>
                                    </tr>
                                  )) : (
                                    <tr>
                                      <td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic">No line items recorded for this sample order.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Modal Footer Summary */}
                        <div className="shrink-0 bg-slate-50 border-t border-slate-100 p-4 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="flex gap-6 sm:gap-10">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Type</p>
                              <p className="text-sm font-bold text-slate-700">{selectedOrder.orderType || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Person</p>
                              <p className="text-sm font-bold text-slate-700">{selectedOrder.contactName || 'Lok'}</p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
                            <span className="text-2xl sm:text-4xl font-black text-upl-orange">${selectedOrder.grandTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="space-y-8">
                <div className="flex flex-col gap-2">
                  <h1 className="text-3xl font-bold text-upl-blue">Financial Invoices</h1>
                  <p className="text-slate-500">Manage your billing records and track payment history with precision.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {invoices.map((inv) => (
                    <motion.div
                      key={inv.id}
                      whileHover={{ scale: 1.01 }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-upl-orange/20 transition-all p-6 group cursor-pointer"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-upl-blue group-hover:bg-upl-orange group-hover:text-white transition-colors duration-300">
                            <FileText className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg font-black text-upl-blue group-hover:text-upl-orange transition-colors">{inv.invoiceNumber}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${inv.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {inv.status}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5" />
                              {inv.invoiceDate}
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              <span className="text-xs uppercase font-bold text-slate-400">SAP: {inv.sapId}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-8 pl-14 md:pl-0">
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Amount</p>
                            <p className="text-2xl font-black text-slate-900 group-hover:text-upl-orange transition-colors leading-none">${inv.grandTotal.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="hidden sm:flex p-2 text-slate-300 group-hover:text-upl-orange group-hover:bg-orange-50 rounded-xl transition-all">
                              <ArrowRight className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {invoices.length === 0 && (
                  <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                    <FileText className="w-16 h-16 mb-4 opacity-10" />
                    <p className="text-lg font-medium">No invoices found.</p>
                  </div>
                )}

                {/* Detailed View Modal */}
                <AnimatePresence>
                  {selectedInvoice && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedInvoice(null)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
                      >
                        <div className="max-h-[92vh] overflow-y-auto scroll-upl">
                          {/* Modal Header */}
                          <div className="bg-gradient-to-r from-upl-orange to-orange-400 p-5 sm:p-8 flex justify-between items-start min-h-[7rem]">
                            <div>
                              <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-xl">
                                  <FileText className="w-6 h-6 text-white" />
                                </div>
                                <h2 className="text-2xl font-black text-white">Invoice Details</h2>
                              </div>
                              <p className="text-orange-50/80 text-sm font-medium mt-1 ml-11">{selectedInvoice.invoiceNumber}</p>
                            </div>
                            <button
                              onClick={() => setSelectedInvoice(null)}
                              className="p-2 bg-white/20 hover:bg-white/40 rounded-xl text-white transition-all backdrop-blur-sm"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Modal Body */}
                          <div className="p-5 sm:p-10 pt-5 sm:pt-8 space-y-6 sm:space-y-8 bg-gradient-to-b from-orange-50/30 to-white">
                            <div className="flex justify-between items-center border-b border-orange-100 pb-6">
                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Status</p>
                                <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${selectedInvoice.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {selectedInvoice.status === 'Approved' ? <CircleCheck className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                  {selectedInvoice.status}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Amount</p>
                                <p className="text-4xl font-black text-upl-orange">${selectedInvoice.grandTotal.toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 sm:gap-x-12 gap-y-5 sm:gap-y-8">
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">SAP Transaction ID</p>
                                <p className="text-sm font-bold text-slate-900 font-mono tracking-tight bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 inline-block">{selectedInvoice.sapId}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Unique Record ID</p>
                                <p className="text-sm font-bold text-slate-900 font-mono tracking-tight">{selectedInvoice.id}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Invoice Date</p>
                                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-upl-orange" />
                                  {selectedInvoice.invoiceDate}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Related Order</p>
                                <button
                                  onClick={() => {
                                    setHighlightedOrderId(selectedInvoice.orderId);
                                    setActiveTab('orders');
                                    setSelectedInvoice(null);
                                  }}
                                  className="text-sm font-black text-upl-blue hover:text-upl-orange underline underline-offset-4 decoration-2 decoration-upl-blue/30 hover:decoration-upl-orange/30 transition-all flex items-center gap-1.5 text-left"
                                >
                                  {selectedInvoice.orderId}
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Distributor Name</p>
                                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                  <div className="w-8 h-8 rounded-lg bg-orange-50 text-upl-orange flex items-center justify-center">
                                    <User className="w-4 h-4" />
                                  </div>
                                  <p className="text-sm font-bold text-slate-900">{selectedInvoice.distributorName}</p>
                                </div>
                              </div>
                            </div>

                            {/* Product Line Items */}
                            {(() => {
                              const linkedOrder = orders.find(o => o.id === selectedInvoice.orderId);
                              if (!linkedOrder || linkedOrder.items.length === 0) return null;
                              return (
                                <div className="space-y-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Package className="w-3.5 h-3.5 text-upl-orange" />
                                    Products in this Invoice
                                  </p>
                                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left">
                                      <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                          <th className="px-4 py-3">Product</th>
                                          <th className="px-4 py-3 text-center">Qty</th>
                                          <th className="px-4 py-3">Unit Price</th>
                                          <th className="px-4 py-3 text-right">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                        {linkedOrder.items.map(item => (
                                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                              <p className="text-sm font-bold text-upl-orange">{item.productName}</p>
                                              <p className="text-[10px] font-mono text-slate-400">{item.sku} · {item.technicalName}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <span className="px-3 py-1 bg-blue-50 text-upl-blue rounded-xl text-xs font-black">{item.quantity}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-600">${item.billingPrice.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-black text-slate-900">
                                              ${((item.billingPrice - item.discountPrice) * item.quantity).toLocaleString()}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Actions */}
                            <div className="pt-6 grid grid-cols-2 gap-4">
                              <button className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all">
                                <FileText className="w-5 h-5 text-upl-orange" />
                                Download PDF
                              </button>
                              <button className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-upl-orange text-white font-black shadow-xl shadow-upl-orange/30 hover:scale-[1.02] active:scale-95 transition-all">
                                Pay Now
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {activeTab === 'grn' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-upl-blue">Goods Receipt Note</h1>
                    <p className="text-slate-500">View shipment overview, EPOD details and GRN documents.</p>
                  </div>

                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Shipment List */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Shipments</h3>
                      <span className="bg-upl-blue text-white text-[10px] px-2 py-0.5 rounded-full font-black">{orders.filter(o => o.status !== 'Draft').length}</span>
                    </div>

                    <div className="space-y-3 overflow-y-auto max-h-[400px] lg:max-h-[calc(100vh-320px)]">
                      {orders.filter(o => o.status !== 'Draft').map((order) => {
                        const isActive = selectedTrackingOrderId === order.id;
                        return (
                          <button
                            key={order.id}
                            onClick={() => setSelectedTrackingOrderId(order.id)}
                            className={`
                              w-full text-left p-5 rounded-3xl border transition-all duration-300 group relative overflow-hidden
                              ${isActive
                                ? 'bg-upl-blue border-upl-blue shadow-xl shadow-blue-900/20'
                                : 'bg-white border-slate-200 hover:border-upl-blue/30 shadow-sm'}
                            `}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeShipment"
                                className="absolute left-0 top-0 bottom-0 w-1.5 bg-upl-orange"
                              />
                            )}
                            <div className="flex justify-between items-start mb-3">
                              <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                <Truck className="w-5 h-5" />
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                                {order.status}
                              </span>
                            </div>
                            <h4 className={`font-black text-lg ${isActive ? 'text-white' : 'text-upl-blue'}`}>{order.id}</h4>
                            <p className={`text-xs font-medium mt-1 ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>
                              Distributor: {order.distributorName}
                            </p>
                            <div className="mt-4 flex justify-between items-center">
                              <p className={`text-sm font-black ${isActive ? 'text-white' : 'text-slate-900'}`}>${order.grandTotal.toLocaleString()}</p>
                              <div className={`flex items-center gap-1.5 text-[10px] font-bold ${isActive ? 'text-blue-300' : 'text-slate-400'}`}>
                                <Calendar className="w-3 h-3" />
                                {order.orderDate}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Shipment Overview */}
                  <div className="lg:col-span-8">
                    {selectedTrackingOrderId ? (() => {
                      const order = orders.find(o => o.id === selectedTrackingOrderId)!;
                      const isDelivered = order.status === 'Delivered';
                      const suffix = order.id.split('-').pop()!;
                      const epodId = `EPOD-${order.plant.replace(/\s+/g, '').slice(0, 3).toUpperCase()}-${suffix}`;
                      const dispatchId = `DISP-${suffix}-UPL`;
                      const consigneeCopy = `GRN-CONS-${order.id}`;

                      return (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                          {/* Header */}
                          <div className="bg-gradient-to-r from-upl-blue to-blue-700 p-5 sm:p-8 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                              <div className="bg-white/15 p-3 rounded-2xl">
                                <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                              </div>
                              <div>
                                <h2 className="text-xl sm:text-2xl font-black text-white">Shipment Overview</h2>
                                <p className="text-blue-200 text-sm font-mono mt-0.5">{order.id} · {order.distributorName}</p>
                              </div>
                            </div>
                            <span className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isDelivered
                                ? 'bg-emerald-400/20 text-emerald-200'
                                : 'bg-white/15 text-blue-100'
                              }`}>
                              {order.status}
                            </span>
                          </div>

                          {/* Overview Fields */}
                          <div className="p-5 sm:p-8 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {[
                                { label: 'EPOD ID', value: epodId, icon: Upload, color: 'text-upl-orange', bg: 'bg-orange-50' },
                                { label: 'Date', value: order.orderDate, icon: Calendar, color: 'text-upl-blue', bg: 'bg-blue-50' },
                                { label: 'Dispatch ID', value: dispatchId, icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50' },
                                { label: 'Consignee Copy', value: consigneeCopy, icon: FileUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Dealer Name', value: order.distributorName, icon: User, color: 'text-slate-600', bg: 'bg-slate-100' },
                              ].map(({ label, value, icon: Icon, color, bg }) => (
                                <motion.div
                                  key={label}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white transition-all group"
                                >
                                  <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                                    <Icon className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                                    <p className="text-sm font-black text-slate-900 font-mono truncate">{value}</p>
                                  </div>
                                </motion.div>
                              ))}
                            </div>

                            {/* EPOD View-Only Status */}
                            {isDelivered ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-4 p-5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                                    <CircleCheck className="w-5 h-5 text-emerald-500" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-emerald-700">EPOD Uploaded by Delivery Agent</p>
                                    <p className="text-xs text-emerald-600/70 mt-0.5">Proof of delivery confirmed and registered in the SAP system.</p>
                                  </div>
                                </div>
                                <button className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl border-2 border-upl-blue text-upl-blue font-black text-sm hover:bg-blue-50 active:scale-[0.99] transition-all">
                                  <FileText className="w-4 h-4" />
                                  VIEW EPOD DOCUMENT
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-4 p-5 bg-amber-50 border border-amber-100 rounded-2xl">
                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                                  <Clock className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-amber-700">Awaiting EPOD from Delivery Agent</p>
                                  <p className="text-xs text-amber-600/70 mt-0.5">The delivery person will upload proof of delivery upon arrival.</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="bg-slate-50 border-t border-slate-100 px-5 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-5 text-xs text-slate-400 font-bold flex-wrap">
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-upl-orange" />
                                {order.plant}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-upl-blue" />
                                Due: {order.dueDate || 'TBD'}
                              </span>
                            </div>
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-upl-blue hover:text-upl-blue rounded-xl text-xs font-black text-slate-600 transition-all">
                              <FileText className="w-4 h-4 text-upl-orange" />
                              DOWNLOAD GRN
                            </button>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="bg-white rounded-[2.5rem] border border-slate-200 border-dashed p-20 flex flex-col items-center justify-center text-slate-400">
                        <FileText className="w-20 h-20 mb-6 opacity-10" />
                        <h3 className="text-xl font-bold text-slate-300">Select a shipment to view</h3>
                        <p className="text-sm opacity-60 mt-2">GRN details will appear here once you select an order.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="max-w-4xl mx-auto space-y-6">

                {/* Hero Card */}
                <div className="relative bg-white rounded-3xl border border-slate-100 shadow-lg overflow-hidden">
                  {/* Banner */}
                  <div className="h-44 bg-gradient-to-br from-upl-blue via-blue-500 to-indigo-600 relative">
                    <div className="absolute inset-0 opacity-10"
                      style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                    <div className="absolute bottom-4 right-6">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">UPL Distributor Portal</span>
                    </div>
                  </div>

                  <div className="px-4 sm:px-8 pb-4 sm:pb-8">
                    {/* Avatar + Edit row */}
                    <div className="flex items-end justify-between -mt-14 mb-5">
                      <div className="relative">
                        <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-upl-blue to-indigo-600 p-[3px] shadow-xl shadow-blue-200">
                          <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                            <span className="text-3xl font-black text-upl-blue">L</span>
                          </div>
                        </div>
                        <span className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white" />
                      </div>
                      <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                        <User className="w-4 h-4" />
                        Edit Profile
                      </button>
                    </div>

                    {/* Name + badge */}
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-3xl font-black text-slate-900">Lok</h2>
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-black uppercase tracking-widest border border-emerald-100">
                        Active
                      </span>
                    </div>
                    <p className="text-slate-400 font-medium text-sm">Authorized Distributor &nbsp;·&nbsp; Mumbai, India</p>

                    {/* Divider */}
                    <div className="my-7 border-t border-slate-100" />

                    {/* Info grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-upl-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">Email</p>
                          <p className="text-sm font-bold text-slate-800 truncate">lok@upl-fi.com</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-upl-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">Phone</p>
                          <p className="text-sm font-bold text-slate-800">+91 98765 43210</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">Location</p>
                          <p className="text-sm font-bold text-slate-800">Mumbai, India</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {[
                    { label: 'Orders', value: '2', color: 'from-upl-blue to-indigo-600', light: 'bg-blue-50 text-upl-blue' },
                    { label: 'Delivered', value: '1', color: 'from-emerald-500 to-teal-500', light: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Credit', value: '₹4.5L', color: 'from-upl-orange to-amber-500', light: 'bg-orange-50 text-upl-orange' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-5 flex flex-col gap-1 sm:gap-2">
                      <span className={`text-[9px] sm:text-[10px] uppercase tracking-wide sm:tracking-widest font-black ${stat.light.split(' ')[1]}`}>{stat.label}</span>
                      <span className={`text-2xl sm:text-3xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</span>
                    </div>
                  ))}
                </div>

                {/* Saved Addresses */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h3 className="font-black text-upl-blue flex items-center gap-2 text-sm uppercase tracking-widest">
                      <MapPin className="w-4 h-4 text-upl-orange" />
                      Saved Addresses
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={profileAddresses.sameAsBilling}
                        onChange={e => {
                          const same = e.target.checked;
                          setProfileAddresses(prev => ({
                            ...prev,
                            sameAsBilling: same,
                            shippingAddress: same ? { ...prev.billingAddress } : prev.shippingAddress,
                          }));
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-upl-orange focus:ring-upl-orange cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-500 group-hover:text-upl-blue transition-colors">Shipping same as billing</span>
                    </label>
                  </div>

                  <div className="p-5 sm:p-6 space-y-6">
                    {/* Billing Address */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-upl-blue pl-3">Billing Address</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { key: 'street', label: 'Street', span: true },
                          { key: 'city', label: 'City' },
                          { key: 'state', label: 'State' },
                          { key: 'country', label: 'Country' },
                          { key: 'zipCode', label: 'ZIP Code' },
                        ].map(({ key, label, span }) => (
                          <div key={key} className={span ? 'sm:col-span-2' : ''}>
                            <input
                              placeholder={label}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-upl-blue focus:bg-white transition-all"
                              value={(profileAddresses.billingAddress as any)[key]}
                              onChange={e => {
                                const val = e.target.value;
                                setProfileAddresses(prev => ({
                                  ...prev,
                                  billingAddress: { ...prev.billingAddress, [key]: val },
                                  shippingAddress: prev.sameAsBilling
                                    ? { ...prev.billingAddress, [key]: val }
                                    : prev.shippingAddress,
                                }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Shipping Address */}
                    {!profileAddresses.sameAsBilling && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3"
                      >
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-upl-orange pl-3">Shipping Address</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { key: 'street', label: 'Street', span: true },
                            { key: 'city', label: 'City' },
                            { key: 'state', label: 'State' },
                            { key: 'country', label: 'Country' },
                            { key: 'zipCode', label: 'ZIP Code' },
                          ].map(({ key, label, span }) => (
                            <div key={key} className={span ? 'sm:col-span-2' : ''}>
                              <input
                                placeholder={label}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-upl-orange focus:bg-white transition-all"
                                value={(profileAddresses.shippingAddress as any)[key]}
                                onChange={e => setProfileAddresses(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, [key]: e.target.value },
                                }))}
                              />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Save button */}
                    <button
                      onClick={handleSaveProfileAddress}
                      className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${addressSaved
                          ? 'bg-emerald-500 text-white scale-[0.99]'
                          : 'bg-upl-blue text-white hover:bg-blue-900 active:scale-[0.99]'
                        }`}
                    >
                      {addressSaved ? (
                        <><CircleCheck className="w-4 h-4" /> Address Saved — will auto-fill in new orders</>
                      ) : (
                        <><MapPin className="w-4 h-4" /> Save Address</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Support CTA */}
                <button className="w-full bg-gradient-to-r from-upl-orange to-amber-500 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-orange-200 hover:shadow-orange-300 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 text-base">
                  <Bell className="w-5 h-5" />
                  Contact Support Admin
                </button>

                {/* Logout */}
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to log out?')) {
                      setIsLoggedIn(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 border-red-100 bg-white text-red-500 font-black text-base hover:bg-red-50 hover:border-red-200 active:scale-[0.99] transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  Log Out
                </button>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-upl-blue/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Activity className="w-10 h-10 text-upl-blue" />
                  </div>
                  <h1 className="text-4xl font-black text-upl-blue italic">Privacy Policy</h1>
                  <p className="text-slate-400 font-medium">Last updated: May 11, 2026</p>
                </div>

                <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 p-6 sm:p-12 shadow-xl space-y-10">
                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-upl-blue uppercase tracking-widest flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-upl-orange" />
                      1. Data Collection
                    </h2>
                    <p className="text-slate-600 leading-relaxed font-medium">
                      UPL Ltd collects information that identifies, relates to, describes, or is reasonably capable of being associated with you. This includes distributor details, order history, and geographic territory information required for SAP integration and logistics fulfillment.
                    </p>
                  </section>
                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-emerald-600 uppercase tracking-widest flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      2. Security Disclosure
                    </h2>
                    <p className="text-slate-600 leading-relaxed font-medium">
                      We utilize enterprise-grade security protocols (AES-256) to ensure your ordering data remains confidential. Access to this portal is restricted to authenticated partners only.
                    </p>
                  </section>
                  <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">End of Document</p>
                </div>
              </div>
            )}

            {activeTab === 'terms' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <CheckSquare className="w-10 h-10 text-upl-orange" />
                  </div>
                  <h1 className="text-4xl font-black text-upl-blue italic">Terms of Service</h1>
                  <p className="text-slate-400 font-medium">Distributor Agreement v4.2</p>
                </div>

                <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 p-6 sm:p-12 shadow-xl space-y-8">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-2">Usage Agreement</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      By utilizing the UPL Distributor Portal, you agree to abide by our fair credit policies. Orders are legally binding once they reach the "Processing" stage in our SAP backend.
                    </p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-2">EPOD Compliance</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      All shipments must have a valid Electronic Proof of Delivery (EPOD) uploaded within 12 hours of arrival to the doorstep to maintain logistics priority.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer / Contact Widget */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 text-slate-400 text-xs font-medium">
          <p>© 2026 UPL Limited. All rights reserved.</p>
          <div className="flex gap-10">
            <button
              onClick={() => setActiveTab('privacy')}
              className={`hover:text-upl-orange transition-colors uppercase tracking-widest leading-none mt-1 ${activeTab === 'privacy' ? 'text-upl-orange' : ''}`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`hover:text-upl-orange transition-colors uppercase tracking-widest leading-none mt-1 ${activeTab === 'terms' ? 'text-upl-orange' : ''}`}
            >
              Terms of Service
            </button>
          </div>
        </div>
      </footer>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[8vh] px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl shadow-slate-900/25 overflow-hidden border border-slate-200"
            >
              {/* Input row */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search orders, invoices, shipments…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none bg-transparent"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                  className="hidden sm:block px-2 py-1 text-[10px] font-black text-slate-400 bg-slate-100 rounded border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  ESC
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[55vh] overflow-y-auto">
                {!searchQuery.trim() ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-slate-300">
                    <Search className="w-10 h-10 opacity-40" />
                    <p className="text-sm font-semibold">Type to search orders &amp; invoices</p>
                    <p className="text-[11px] text-slate-400">Try an order ID, status, or invoice number</p>
                  </div>
                ) : searchResults.orders.length === 0 && searchResults.invoices.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                    <p className="text-sm font-semibold">No results for <span className="text-slate-600">"{searchQuery}"</span></p>
                    <p className="text-[11px] text-slate-400">Try a different keyword</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {searchResults.orders.length > 0 && (
                      <>
                        <p className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Orders</p>
                        {searchResults.orders.map(order => (
                          <button
                            key={order.id}
                            onClick={() => {
                              setActiveTab('orders');
                              setSelectedOrder(order);
                              setIsSearchOpen(false);
                              setSearchQuery('');
                            }}
                            className="w-full text-left flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors group"
                          >
                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-upl-blue flex items-center justify-center shrink-0 group-hover:bg-upl-blue group-hover:text-white transition-all duration-200">
                              <ShoppingBag className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-upl-blue">{order.id}</p>
                              <p className="text-[11px] text-slate-500 truncate">{order.orderType} · {order.plant}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-slate-900">${order.grandTotal.toLocaleString()}</p>
                              <span className={`text-[10px] font-bold ${order.status === 'Delivered' ? 'text-emerald-500' :
                                  order.status === 'Shipped' ? 'text-blue-500' : 'text-amber-500'
                                }`}>{order.status}</span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {searchResults.invoices.length > 0 && (
                      <>
                        <p className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoices</p>
                        {searchResults.invoices.map(inv => (
                          <button
                            key={inv.id}
                            onClick={() => {
                              setActiveTab('invoices');
                              setSelectedInvoice(inv);
                              setIsSearchOpen(false);
                              setSearchQuery('');
                            }}
                            className="w-full text-left flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors group"
                          >
                            <div className="w-9 h-9 rounded-xl bg-orange-50 text-upl-orange flex items-center justify-center shrink-0 group-hover:bg-upl-orange group-hover:text-white transition-all duration-200">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800">{inv.invoiceNumber}</p>
                              <p className="text-[11px] text-slate-500">SAP: {inv.sapId} · {inv.distributorName}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-slate-900">${inv.grandTotal.toLocaleString()}</p>
                              <span className={`text-[10px] font-bold ${inv.status === 'Approved' ? 'text-emerald-500' : 'text-amber-500'}`}>{inv.status}</span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer hint bar */}
              <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-5 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50/60">
                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px]">↵</kbd> Open</span>
                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px]">ESC</kbd> Close</span>
                <span className="ml-auto">⌘K to toggle</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-lg">
        <div className="flex">
          {[
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'orders', label: 'Orders', icon: ShoppingBag },
            { id: 'invoices', label: 'Invoices', icon: FileText },
            { id: 'grn', label: 'GRN', icon: CheckSquare },
            { id: 'profile', label: 'Profile', icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all ${isActive ? 'text-upl-orange' : 'text-slate-400'
                  }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-orange-50' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
