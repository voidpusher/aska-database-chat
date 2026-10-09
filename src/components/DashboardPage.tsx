import { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Package,
  IndianRupee,
  MessageSquare,
  Database,
  Settings,
  LogOut,
  HelpCircle,
  User,
  Calendar,
  Eye,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Progress } from "./ui/progress";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import {
  safeJsonParse,
  safeStorageGet,
  safeStorageSet,
} from "../lib/storage";
import {
  api,
  type DashboardDetailsResponse,
  type DashboardOrdersResponse,
  type DashboardSummaryResponse,
  type StoredDatabaseConnection,
} from "../lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";

interface DashboardPageProps {
  onLogout: () => void;
  onNavigateToSupport: () => void;
  onNavigateToChat: () => void;
  onNavigateToLanding?: () => void;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  sold: number;
  revenue: number;
  stock: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  orders: number;
  totalSpent: number;
  lastOrder: string;
}

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  productId: string;
  productName: string;
  quantity: number;
  total: number;
  date: string;
}

const DATA_VERSION = "2.2";

const initialProducts: Product[] = [
  {
    id: "1",
    name: "Samsung Galaxy A34 5G",
    category: "Mobile Phones",
    price: 28999,
    sold: 47,
    revenue: 1362953,
    stock: 12,
  },
  {
    id: "2",
    name: "boAt Rockerz 450 Bluetooth Headphones",
    category: "Audio Devices",
    price: 1299,
    sold: 156,
    revenue: 202644,
    stock: 45,
  },
  {
    id: "3",
    name: "Lenovo IdeaPad Slim 3",
    category: "Laptops",
    price: 42999,
    sold: 23,
    revenue: 988977,
    stock: 6,
  },
  {
    id: "4",
    name: "Samsung 43\" Smart LED TV",
    category: "Televisions",
    price: 32999,
    sold: 34,
    revenue: 1121966,
    stock: 8,
  },
  {
    id: "5",
    name: "Realme Buds Air 3 TWS Earbuds",
    category: "Audio Devices",
    price: 2999,
    sold: 89,
    revenue: 266911,
    stock: 67,
  },
  {
    id: "6",
    name: "HP LaserJet M126nw Printer",
    category: "Printers & Scanners",
    price: 12499,
    sold: 19,
    revenue: 237481,
    stock: 11,
  },
  {
    id: "7",
    name: "Logitech K380 Wireless Keyboard",
    category: "Computer Accessories",
    price: 1899,
    sold: 78,
    revenue: 148122,
    stock: 34,
  },
  {
    id: "8",
    name: "Xiaomi Power Bank 20000mAh",
    category: "Mobile Accessories",
    price: 1599,
    sold: 134,
    revenue: 214266,
    stock: 89,
  },
];

const initialCustomers: Customer[] = [
  {
    id: "1",
    name: "Amit Kumar",
    email: "amit.kumar@email.com",
    phone: "+91 98765 43210",
    orders: 18,
    totalSpent: 187450,
    lastOrder: "2 hours ago",
  },
  {
    id: "2",
    name: "Rajesh Electronics",
    email: "rajesh@business.com",
    phone: "+91 98765 43211",
    orders: 16,
    totalSpent: 165800,
    lastOrder: "5 hours ago",
  },
  {
    id: "3",
    name: "Priya Patel",
    email: "priya.patel@email.com",
    phone: "+91 98765 43212",
    orders: 15,
    totalSpent: 143200,
    lastOrder: "1 day ago",
  },
  
  {
    id: "4",
    name: "Vikash Singh",
    email: "vikash@email.com",
    phone: "+91 98765 43213",
    orders: 14,
    totalSpent: 128900,
    lastOrder: "1 day ago",
  },
  {
    id: "5",
    name: "Sneha Gupta",
    email: "sneha.gupta@email.com",
    phone: "+91 98765 43214",
    orders: 12,
    totalSpent: 98600,
    lastOrder: "2 days ago",
  },
  {
    id: "6",
    name: "Karthik Reddy",
    email: "karthik@email.com",
    phone: "+91 98765 43215",
    orders: 11,
    totalSpent: 89750,
    lastOrder: "2 days ago",
  },
  {
    id: "7",
    name: "Divya Sharma",
    email: "divya@email.com",
    phone: "+91 98765 43216",
    orders: 10,
    totalSpent: 76400,
    lastOrder: "3 days ago",
  },
  
  {
    id: "8",
    name: "Arjun Malhotra",
    email: "arjun@email.com",
    phone: "+91 98765 43217",
    orders: 9,
    totalSpent: 67200,
    lastOrder: "3 days ago",
  },
  {
    id: "9",
    name: "Meera Iyer",
    email: "meera@email.com",
    phone: "+91 98765 43218",
    orders: 8,
    totalSpent: 58900,
    lastOrder: "4 days ago",
  },
  {
    id: "10",
    name: "Rohit Verma",
    email: "rohit@email.com",
    phone: "+91 98765 43219",
    orders: 8,
    totalSpent: 54300,
    lastOrder: "5 days ago",
  },
  {
    id: "11",
    name: "Anjali Desai",
    email: "anjali@email.com",
    phone: "+91 98765 43220",
    orders: 7,
    totalSpent: 49800,
    lastOrder: "5 days ago",
  },
  {
    id: "12",
    name: "Sanjay Mehta",
    email: "sanjay@email.com",
    phone: "+91 98765 43221",
    orders: 7,
    totalSpent: 46200,
    lastOrder: "6 days ago",
  },
  {
    id: "13",
    name: "Pooja Nair",
    email: "pooja@email.com",
    phone: "+91 98765 43222",
    orders: 6,
    totalSpent: 42100,
    lastOrder: "1 week ago",
  },
  
  {
    id: "14",
    name: "Ravi Krishnan",
    email: "ravi@email.com",
    phone: "+91 98765 43223",
    orders: 5,
    totalSpent: 36700,
    lastOrder: "1 week ago",
  },
  {
    id: "15",
    name: "Neha Kapoor",
    email: "neha@email.com",
    phone: "+91 98765 43224",
    orders: 5,
    totalSpent: 33400,
    lastOrder: "1 week ago",
  },
  {
    id: "16",
    name: "Suresh Babu",
    email: "suresh@email.com",
    phone: "+91 98765 43225",
    orders: 4,
    totalSpent: 29600,
    lastOrder: "2 weeks ago",
  },
  {
    id: "17",
    name: "Kavita Singh",
    email: "kavita@email.com",
    phone: "+91 98765 43226",
    orders: 4,
    totalSpent: 27300,
    lastOrder: "2 weeks ago",
  },
  {
    id: "18",
    name: "Manoj Tiwari",
    email: "manoj@email.com",
    phone: "+91 98765 43227",
    orders: 4,
    totalSpent: 24800,
    lastOrder: "2 weeks ago",
  },
  
  {
    id: "19",
    name: "Deepa Rao",
    email: "deepa@email.com",
    phone: "+91 98765 43228",
    orders: 3,
    totalSpent: 19500,
    lastOrder: "2 weeks ago",
  },
  {
    id: "20",
    name: "Anil Joshi",
    email: "anil@email.com",
    phone: "+91 98765 43229",
    orders: 3,
    totalSpent: 17200,
    lastOrder: "3 weeks ago",
  },
  {
    id: "21",
    name: "Sunita Devi",
    email: "sunita@email.com",
    phone: "+91 98765 43230",
    orders: 3,
    totalSpent: 15600,
    lastOrder: "3 weeks ago",
  },
  {
    id: "22",
    name: "Ramesh Pillai",
    email: "ramesh@email.com",
    phone: "+91 98765 43231",
    orders: 2,
    totalSpent: 12400,
    lastOrder: "3 weeks ago",
  },
  {
    id: "23",
    name: "Geeta Agarwal",
    email: "geeta@email.com",
    phone: "+91 98765 43232",
    orders: 2,
    totalSpent: 10800,
    lastOrder: "1 month ago",
  },
  {
    id: "24",
    name: "Harish Chandra",
    email: "harish@email.com",
    phone: "+91 98765 43233",
    orders: 2,
    totalSpent: 9200,
    lastOrder: "1 month ago",
  },
  {
    id: "25",
    name: "Lakshmi Menon",
    email: "lakshmi@email.com",
    phone: "+91 98765 43234",
    orders: 2,
    totalSpent: 8500,
    lastOrder: "1 month ago",
  },
];

const initialOrders: Order[] = [
  {
    id: "ord-2024110501",
    customerId: "1",
    customerName: "Amit Kumar",
    customerEmail: "amit.kumar@email.com",
    customerPhone: "+91 98765 43210",
    productId: "1",
    productName: "Samsung Galaxy A34 5G",
    quantity: 2,
    total: 57998,
    date: "03 Nov 2024 14:30",
  },
  {
    id: "ord-2024110502",
    customerId: "2",
    customerName: "Rajesh Electronics",
    customerEmail: "rajesh@business.com",
    customerPhone: "+91 98765 43211",
    productId: "3",
    productName: "Lenovo IdeaPad Slim 3",
    quantity: 1,
    total: 42999,
    date: "03 Nov 2024 15:45",
  },
  {
    id: "ord-2024110503",
    customerId: "3",
    customerName: "Priya Patel",
    customerEmail: "priya.patel@email.com",
    customerPhone: "+91 98765 43212",
    productId: "2",
    productName: "boAt Rockerz 450 Bluetooth Headphones",
    quantity: 3,
    total: 3897,
    date: "04 Nov 2024 10:15",
  },
  {
    id: "ord-2024110504",
    customerId: "1",
    customerName: "Amit Kumar",
    customerEmail: "amit.kumar@email.com",
    customerPhone: "+91 98765 43210",
    productId: "8",
    productName: "Xiaomi Power Bank 20000mAh",
    quantity: 5,
    total: 7995,
    date: "04 Nov 2024 11:20",
  },
  {
    id: "ord-2024110505",
    customerId: "4",
    customerName: "Vikash Singh",
    customerEmail: "vikash@email.com",
    customerPhone: "+91 98765 43213",
    productId: "4",
    productName: "Samsung 43\" Smart LED TV",
    quantity: 1,
    total: 32999,
    date: "04 Nov 2024 12:30",
  },
  {
    id: "ord-2024110506",
    customerId: "5",
    customerName: "Sneha Gupta",
    customerEmail: "sneha.gupta@email.com",
    customerPhone: "+91 98765 43214",
    productId: "5",
    productName: "Realme Buds Air 3 TWS Earbuds",
    quantity: 2,
    total: 5998,
    date: "04 Nov 2024 13:45",
  },
  {
    id: "ord-2024110507",
    customerId: "6",
    customerName: "Karthik Reddy",
    customerEmail: "karthik@email.com",
    customerPhone: "+91 98765 43215",
    productId: "7",
    productName: "Logitech K380 Wireless Keyboard",
    quantity: 4,
    total: 7596,
    date: "04 Nov 2024 16:00",
  },
  {
    id: "ord-2024110508",
    customerId: "2",
    customerName: "Rajesh Electronics",
    customerEmail: "rajesh@business.com",
    customerPhone: "+91 98765 43211",
    productId: "6",
    productName: "HP LaserJet M126nw Printer",
    quantity: 1,
    total: 12499,
    date: "05 Nov 2024 09:30",
  },
  {
    id: "ord-2024110509",
    customerId: "7",
    customerName: "Divya Sharma",
    customerEmail: "divya@email.com",
    customerPhone: "+91 98765 43216",
    productId: "1",
    productName: "Samsung Galaxy A34 5G",
    quantity: 1,
    total: 28999,
    date: "05 Nov 2024 10:45",
  },
  {
    id: "ord-2024110510",
    customerId: "8",
    customerName: "Arjun Malhotra",
    customerEmail: "arjun@email.com",
    customerPhone: "+91 98765 43217",
    productId: "2",
    productName: "boAt Rockerz 450 Bluetooth Headphones",
    quantity: 6,
    total: 7794,
    date: "05 Nov 2024 11:15",
  },
  {
    id: "ord-2024110511",
    customerId: "9",
    customerName: "Meera Iyer",
    customerEmail: "meera@email.com",
    customerPhone: "+91 98765 43218",
    productId: "4",
    productName: "Samsung 43\" Smart LED TV",
    quantity: 1,
    total: 32999,
    date: "05 Nov 2024 13:00",
  },
  {
    id: "ord-2024110512",
    customerId: "3",
    customerName: "Priya Patel",
    customerEmail: "priya.patel@email.com",
    customerPhone: "+91 98765 43212",
    productId: "8",
    productName: "Xiaomi Power Bank 20000mAh",
    quantity: 10,
    total: 15990,
    date: "05 Nov 2024 14:20",
  },
];

export function DashboardPage({
  onLogout,
  onNavigateToSupport,
  onNavigateToChat,
  onNavigateToLanding,
}: DashboardPageProps) {
  const currentUser = safeJsonParse<{ authProvider?: string; businessName?: string; firstName?: string; lastName?: string; email?: string }>(safeStorageGet("orrico_current_user"), {});
  const isDemoUser = currentUser.authProvider === "demo";
  const businessName = isDemoUser ? "Gupta Electronics" : currentUser.businessName || "Your Workspace";
  const ownerName = isDemoUser ? "Arjun Sharma" : `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim();
  const initials = isDemoUser ? "JS" : `${currentUser.firstName?.[0] || ""}${currentUser.lastName?.[0] || ""}`.toUpperCase() || "U";
  const [selectedPeriod, setSelectedPeriod] = useState("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardSummary, setDashboardSummary] =
    useState<DashboardSummaryResponse | null>(null);
  const [dashboardDetails, setDashboardDetails] =
    useState<DashboardDetailsResponse | null>(null);
  const [dashboardOrders, setDashboardOrders] =
    useState<DashboardOrdersResponse | null>(null);
  const [currentConnection, setCurrentConnection] =
    useState<StoredDatabaseConnection | null>(null);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [showEditProductDialog, setShowEditProductDialog] = useState(false);
  const [showEditCustomerDialog, setShowEditCustomerDialog] =
    useState(false);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState("dashboard");
  const [posEnabled, setPosEnabled] = useState(() => {
    if (!isDemoUser) return false;
    const saved = safeStorageGet("orrico_pos_enabled");
    return safeJsonParse(saved, false);
  });
  const posIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [products, setProducts] = useState<Product[]>(() => {
    if (!isDemoUser) return [];
    const savedVersion = safeStorageGet("orrico_data_version");
    
    if (savedVersion !== DATA_VERSION) {
      safeStorageSet("orrico_data_version", DATA_VERSION);
      return initialProducts;
    }
    
    const saved = safeStorageGet("orrico_products");
    return safeJsonParse(saved, initialProducts);
  });

  const getFullCustomerList = () => {
    const additionalCustomers: Customer[] = [];
    const names = [
      "Prakash Jain", "Reena Saxena", "Nitin Gupta", "Shilpa Reddy", "Gaurav Singh",
      "Manju Devi", "Yogesh Kumar", "Radha Krishna", "Sunil Patil", "Kamala Bai",
      "Ashok Mehta", "Swati Kulkarni", "Vinod Sharma", "Pushpa Rani", "Mukesh Tiwari",
      "Sarita Devi", "Kishore Rao", "Usha Nair", "Dinesh Verma", "Anita Singh",
      "Brijesh Pandey", "Lata Mishra", "Santosh Kumar", "Parvati Devi", "Mahesh Gupta",
      "Savita Sharma", "Naresh Yadav", "Rekha Kumari", "Praveen Kumar", "Sushila Devi",
      "Hari Singh", "Shakuntala Rao", "Ramakant Joshi", "Mangala Bai", "Umesh Patil",
      "Vidya Devi", "Gopal Krishna", "Suman Gupta", "Satish Kumar", "Lalita Singh",
      "Pankaj Mehta", "Bharati Devi", "Navin Kumar"
    ];
    
    for (let i = 0; i < 43; i++) {
      additionalCustomers.push({
        id: (26 + i).toString(),
        name: names[i],
        email: `${names[i].toLowerCase().replace(" ", ".")}@email.com`,
        phone: `+91 ${98765 - i} ${43235 + i}`,
        orders: i < 10 ? 2 : 1,
        totalSpent: i < 10 ? Math.floor(7000 + Math.random() * 3000) : Math.floor(3000 + Math.random() * 4000),
        lastOrder: i < 15 ? "1 month ago" : "2 months ago",
      });
    }
    
    return [...initialCustomers, ...additionalCustomers];
  };

  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (!isDemoUser) return [];
    const savedVersion = safeStorageGet("orrico_data_version");
    const saved = safeStorageGet("orrico_customers");
    
    if (savedVersion !== DATA_VERSION || !saved) {
      return getFullCustomerList();
    }
    
    const parsedCustomers = safeJsonParse<Customer[]>(
      saved,
      getFullCustomerList(),
    );
    if (parsedCustomers.length < 68) {
      return getFullCustomerList();
    }
    
    return parsedCustomers;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    if (!isDemoUser) return [];
    const savedVersion = safeStorageGet("orrico_data_version");
    const saved = safeStorageGet("orrico_orders");
    
    if (savedVersion !== DATA_VERSION) {
      return initialOrders;
    }
    
    return safeJsonParse(saved, initialOrders);
  });

  const [todayRevenue, setTodayRevenue] = useState(() => {
    if (!isDemoUser) return 0;
    const saved = safeStorageGet("orrico_today_revenue");
    return saved ? parseFloat(saved) : 145750;
  });

  const [todayOrders, setTodayOrders] = useState(() => {
    if (!isDemoUser) return 0;
    const saved = safeStorageGet("orrico_today_orders");
    return saved ? parseInt(saved) : 18;
  });

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    price: "",
    stock: "",
  });

  const [newOrder, setNewOrder] = useState({
    isNewCustomer: false,
    customerId: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    productId: "",
    quantity: "1",
  });
  const [selectedStockProduct, setSelectedStockProduct] =
    useState<Product | null>(null);
  const [stockAdjustmentValue, setStockAdjustmentValue] = useState("");
  const [selectedEditProduct, setSelectedEditProduct] =
    useState<Product | null>(null);
  const [selectedEditCustomer, setSelectedEditCustomer] =
    useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (isDemoUser) safeStorageSet("orrico_products", JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    if (isDemoUser) safeStorageSet("orrico_customers", JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    if (isDemoUser) safeStorageSet("orrico_orders", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (isDemoUser) safeStorageSet("orrico_today_revenue", todayRevenue.toString());
  }, [todayRevenue]);

  useEffect(() => {
    if (isDemoUser) safeStorageSet("orrico_today_orders", todayOrders.toString());
  }, [todayOrders]);

  useEffect(() => {
    if (isDemoUser) safeStorageSet("orrico_pos_enabled", JSON.stringify(posEnabled));
  }, [posEnabled]);

  const loadDashboardSummary = async ({
    silent = false,
  }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsDashboardLoading(true);
    }

    try {
      const result = await api.dashboardSummary();
      setDashboardSummary(result);

      if (!result.available && result.reason && !silent) {
        toast.info(result.reason);
      }
    } catch (error) {
      if (!silent) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Dashboard summary could not be loaded.",
        );
      }
    } finally {
      if (!silent) {
        setIsDashboardLoading(false);
      }
    }
  };

  const loadDashboardDetails = async ({
    silent = false,
  }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsDashboardLoading(true);
    }

    try {
      const result = await api.dashboardDetails();
      setDashboardDetails(result);

      if (!result.available && result.reason && !silent) {
        toast.info(result.reason);
      }
    } catch (error) {
      if (!silent) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Dashboard details could not be loaded.",
        );
      }
    } finally {
      if (!silent) {
        setIsDashboardLoading(false);
      }
    }
  };

  const loadDashboardOrders = async ({
    silent = false,
  }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsDashboardLoading(true);
    }

    try {
      const result = await api.dashboardOrders();
      setDashboardOrders(result);

      if (!result.available && result.reason && !silent) {
        toast.info(result.reason);
      }
    } catch (error) {
      if (!silent) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Dashboard orders could not be loaded.",
        );
      }
    } finally {
      if (!silent) {
        setIsDashboardLoading(false);
      }
    }
  };

  const loadCurrentConnection = async () => {
    try {
      const result = await api.currentDatabaseConnection();
      setCurrentConnection(result.connection || null);
    } catch {
      setCurrentConnection(null);
    }
  };

  useEffect(() => {
    loadDashboardSummary({ silent: true });
    loadDashboardDetails({ silent: true });
    loadDashboardOrders({ silent: true });
    loadCurrentConnection();
  }, []);

  useEffect(() => {
    if (isDemoUser && posEnabled && !dashboardDetails?.available) {
      const startPosSimulation = () => {
        const randomDelay = Math.random() * 7000 + 8000; // 8-15 seconds
        posIntervalRef.current = setTimeout(() => {
          simulatePosTransaction();
          startPosSimulation(); // Schedule next transaction
        }, randomDelay);
      };

      startPosSimulation();
      toast.success("POS System Connected", {
        description: "Transactions will now sync automatically",
      });

      return () => {
        if (posIntervalRef.current) {
          clearTimeout(posIntervalRef.current);
        }
      };
    } else {
      if (posIntervalRef.current) {
        clearTimeout(posIntervalRef.current);
      }
    }
  }, [dashboardDetails?.available, posEnabled]);

  const simulatePosTransaction = () => {
    if (products.length === 0 || customers.length === 0) return;

    let selectedCustomer: Customer;
    const useExistingCustomer = Math.random() > 0.2;

    if (useExistingCustomer && customers.length > 0) {
      selectedCustomer = customers[Math.floor(Math.random() * customers.length)];
    } else {
      const newCustomerNames = [
        "Store Customer",
        "Anil Verma",
        "Pooja Singh",
        "Rajesh Mehta",
        "Kavita Sharma",
        "Suresh Patel",
        "Neha Gupta",
        "Manoj Kumar",
      ];
      const randomName = newCustomerNames[Math.floor(Math.random() * newCustomerNames.length)];
      const customerId = `pos-${Date.now()}`;
      
      selectedCustomer = {
        id: customerId,
        name: randomName,
        email: `${randomName.toLowerCase().replace(/\s+/g, '')}@shop.com`,
        phone: `+91 ${Math.floor(Math.random() * 90000) + 10000} ${Math.floor(Math.random() * 90000) + 10000}`,
        orders: 0,
        totalSpent: 0,
        lastOrder: "Just now",
      };
      
      setCustomers(prev => [selectedCustomer, ...prev]);
    }

    const numProducts = Math.floor(Math.random() * 3) + 1;
    const selectedProducts: { product: Product; quantity: number }[] = [];
    
    for (let i = 0; i < numProducts; i++) {
      const availableProducts = products.filter(p => p.stock > 0);
      if (availableProducts.length === 0) break;
      
      const product = availableProducts[Math.floor(Math.random() * availableProducts.length)];
      const maxQuantity = Math.min(product.stock, 5);
      const quantity = Math.floor(Math.random() * maxQuantity) + 1;
      
      selectedProducts.push({ product, quantity });
    }

    if (selectedProducts.length === 0) return;

    const total = selectedProducts.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    setProducts(prev =>
      prev.map(p => {
        const purchasedItem = selectedProducts.find(sp => sp.product.id === p.id);
        if (purchasedItem) {
          return {
            ...p,
            sold: p.sold + purchasedItem.quantity,
            stock: p.stock - purchasedItem.quantity,
            revenue: p.revenue + (p.price * purchasedItem.quantity),
          };
        }
        return p;
      })
    );

    setCustomers(prev =>
      prev.map(c =>
        c.id === selectedCustomer.id
          ? {
              ...c,
              orders: c.orders + 1,
              totalSpent: c.totalSpent + total,
              lastOrder: "Just now",
            }
          : c
      )
    );

    setTodayRevenue(prev => prev + total);
    setTodayOrders(prev => prev + 1);

    const now = new Date();
    const dateStr = `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    
    const order: Order = {
      id: `pos-${Date.now()}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerEmail: selectedCustomer.email,
      customerPhone: selectedCustomer.phone,
      productId: selectedProducts[0].product.id,
      productName: selectedProducts.map(sp => `${sp.quantity}x ${sp.product.name}`).join(', '),
      quantity: selectedProducts.reduce((sum, item) => sum + item.quantity, 0),
      total,
      date: dateStr,
    };
    setOrders(prev => [order, ...prev]);

    const productSummary = selectedProducts.length === 1
      ? `${selectedProducts[0].quantity}x ${selectedProducts[0].product.name}`
      : `${selectedProducts.length} items`;

    toast.success("New POS Sale", {
      description: `${selectedCustomer.name} | ${productSummary} | Rs ${total.toLocaleString()}`,
    });
  };

  const togglePosSystem = () => {
    if (!isDemoUser) {
      toast.info("POS simulation is available in demo login only.");
      return;
    }
    if (dashboardDetails?.available) {
      toast.info(
        "POS simulation is disabled while a live database connection is active.",
      );
      return;
    }

    setPosEnabled(!posEnabled);
    if (!posEnabled) {
      toast.info("Enabling POS System...");
    } else {
      toast.info("POS System Disconnected");
    }
  };

  const fallbackSalesData = [
    { date: "Mon", revenue: 125000, orders: 14 },
    { date: "Tue", revenue: 98000, orders: 11 },
    { date: "Wed", revenue: 156000, orders: 19 },
    { date: "Thu", revenue: 189000, orders: 22 },
    { date: "Fri", revenue: 167000, orders: 18 },
    { date: "Sat", revenue: 234000, orders: 28 },
    { date: "Sun", revenue: 198000, orders: 24 },
  ];

  const fallbackCategoryData = [
    {
      name: "Mobile Phones",
      value: 32,
      revenue: 456780,
      color: "#8884d8",
    },
    {
      name: "Laptops",
      value: 18,
      revenue: 387650,
      color: "#82ca9d",
    },
    {
      name: "Televisions",
      value: 15,
      revenue: 298450,
      color: "#ffc658",
    },
    {
      name: "Audio Devices",
      value: 22,
      revenue: 178340,
      color: "#ff7300",
    },
    {
      name: "Accessories",
      value: 13,
      revenue: 124560,
      color: "#00ff88",
    },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast.info("Refreshing dashboard data...");
    await Promise.all([
      loadDashboardSummary({ silent: true }),
      loadDashboardDetails({ silent: true }),
      loadDashboardOrders({ silent: true }),
      loadCurrentConnection(),
    ]);
    setIsRefreshing(false);
    toast.success("Dashboard data refreshed!");
  };

  const handleExport = () => {
    toast.info("Preparing export...");
    setTimeout(() => {
      toast.success("Dashboard data exported successfully!");
    }, 1000);
  };

  const handleAddProduct = () => {
    if (
      currentConnection &&
      currentConnection.databaseType !== "sqlite"
    ) {
      toast.info(
        "Catalog updates are read-only for connected databases right now.",
      );
      return;
    }

    if (!newProduct.name || !newProduct.category || !newProduct.price || !newProduct.stock) {
      toast.error("Please fill in all fields");
      return;
    }

    api
      .createDashboardProduct({
        name: newProduct.name.trim(),
        category: newProduct.category,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock, 10),
      })
      .then(async ({ product }) => {
        setNewProduct({ name: "", category: "", price: "", stock: "" });
        setShowAddProductDialog(false);
        await Promise.all([
          loadDashboardSummary({ silent: true }),
          loadDashboardDetails({ silent: true }),
          loadDashboardOrders({ silent: true }),
        ]);
        toast.success(`Product "${product.name}" added successfully!`);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Product could not be created.",
        );
      });
  };

  const handleNewOrder = () => {
    if (
      currentConnection &&
      currentConnection.databaseType !== "sqlite"
    ) {
      toast.info(
        "Order creation is read-only for connected databases right now.",
      );
      return;
    }

    if (!newOrder.productId || !newOrder.quantity) {
      toast.error("Please select a product and quantity");
      return;
    }

    const product = catalogProducts.find(
      (entry) => entry.id === newOrder.productId,
    );
    if (!product) {
      toast.error("Invalid product");
      return;
    }

    const existingCustomer = newOrder.customerId
      ? catalogCustomers.find((entry) => entry.id === newOrder.customerId)
      : null;
    const customerName = newOrder.isNewCustomer
      ? newOrder.customerName.trim()
      : existingCustomer?.name || "";
    const quantity = parseInt(newOrder.quantity, 10);

    if (newOrder.isNewCustomer) {
      if (!newOrder.customerName || !newOrder.customerEmail) {
        toast.error("Please enter customer name and email");
        return;
      }
    } else {
      if (!newOrder.customerId) {
        toast.error("Please select a customer");
        return;
      }

      if (!existingCustomer) {
        toast.error("Invalid customer");
        return;
      }
    }

    const total = product.price * quantity;

    api
      .createDashboardOrder({
        productId: newOrder.productId,
        quantity,
        customerId: newOrder.isNewCustomer
          ? undefined
          : newOrder.customerId,
        customerName: newOrder.isNewCustomer
          ? newOrder.customerName.trim()
          : undefined,
        customerEmail: newOrder.isNewCustomer
          ? newOrder.customerEmail.trim()
          : undefined,
        customerPhone: newOrder.isNewCustomer
          ? newOrder.customerPhone.trim()
          : undefined,
      })
      .then(async () => {
        setNewOrder({ 
          isNewCustomer: false,
          customerId: "", 
          customerName: "",
          customerEmail: "",
          customerPhone: "",
          productId: "", 
          quantity: "1" 
        });
        setShowNewOrderDialog(false);
        await Promise.all([
          loadDashboardSummary({ silent: true }),
          loadDashboardDetails({ silent: true }),
          loadDashboardOrders({ silent: true }),
        ]);

        const successMessage = newOrder.isNewCustomer 
          ? `New customer "${customerName}" added and order created! ${quantity}x ${product.name} for Rs ${total.toLocaleString()}`
          : `Order created! ${customerName} purchased ${quantity}x ${product.name} for Rs ${total.toLocaleString()}`;

        toast.success(successMessage);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Order could not be created.",
        );
      });
  };

  const handleNavigation = (item: string) => {
    setActiveNavItem(item);
  };

  const openStockDialog = (product: Product) => {
    setSelectedStockProduct(product);
    setStockAdjustmentValue(String(product.stock));
    setShowStockDialog(true);
  };

  const openEditProductDialog = (product: Product) => {
    setSelectedEditProduct(product);
    setNewProduct({
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
    });
    setShowEditProductDialog(true);
  };

  const openEditCustomerDialog = (customer: Customer) => {
    setSelectedEditCustomer(customer);
    setCustomerForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
    });
    setShowEditCustomerDialog(true);
  };

  const handleUpdateStock = () => {
    if (!selectedStockProduct) {
      return;
    }

    if (!canMutateCatalog) {
      toast.info(
        "Stock changes are read-only for connected databases right now.",
      );
      return;
    }

    const nextStock = Number.parseInt(stockAdjustmentValue, 10);

    if (!Number.isInteger(nextStock) || nextStock < 0) {
      toast.error("Stock must be zero or more.");
      return;
    }

    api
      .updateDashboardProductStock(selectedStockProduct.id, nextStock)
      .then(async ({ product }) => {
        setShowStockDialog(false);
        setSelectedStockProduct(null);
        setStockAdjustmentValue("");
        await Promise.all([
          loadDashboardSummary({ silent: true }),
          loadDashboardDetails({ silent: true }),
          loadDashboardOrders({ silent: true }),
        ]);
        toast.success(`Stock updated for "${product.name}".`);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Stock could not be updated.",
        );
      });
  };

  const handleEditProduct = () => {
    if (!selectedEditProduct) {
      return;
    }

    if (!canMutateCatalog) {
      toast.info(
        "Catalog updates are read-only for connected databases right now.",
      );
      return;
    }

    if (
      !newProduct.name ||
      !newProduct.category ||
      !newProduct.price ||
      !newProduct.stock
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    api
      .updateDashboardProduct(selectedEditProduct.id, {
        name: newProduct.name.trim(),
        category: newProduct.category,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock, 10),
      })
      .then(async ({ product }) => {
        setShowEditProductDialog(false);
        setSelectedEditProduct(null);
        setNewProduct({ name: "", category: "", price: "", stock: "" });
        await Promise.all([
          loadDashboardSummary({ silent: true }),
          loadDashboardDetails({ silent: true }),
          loadDashboardOrders({ silent: true }),
        ]);
        toast.success(`Product "${product.name}" updated successfully!`);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Product could not be updated.",
        );
      });
  };

  const handleDeleteProduct = (product: Product) => {
    if (!canMutateCatalog) {
      toast.info(
        "Catalog updates are read-only for connected databases right now.",
      );
      return;
    }

    api
      .deleteDashboardProduct(product.id)
      .then(async ({ product: deleted }) => {
        await Promise.all([
          loadDashboardSummary({ silent: true }),
          loadDashboardDetails({ silent: true }),
          loadDashboardOrders({ silent: true }),
        ]);
        toast.success(`Product "${deleted.name}" deleted successfully!`);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Product could not be deleted.",
        );
      });
  };

  const handleEditCustomer = () => {
    if (!selectedEditCustomer) {
      return;
    }

    if (!canMutateCatalog) {
      toast.info(
        "Customer updates are read-only for connected databases right now.",
      );
      return;
    }

    if (!customerForm.name || !customerForm.email) {
      toast.error("Customer name and email are required.");
      return;
    }

    api
      .updateDashboardCustomer(selectedEditCustomer.id, {
        name: customerForm.name.trim(),
        email: customerForm.email.trim(),
        phone: customerForm.phone.trim(),
      })
      .then(async ({ customer }) => {
        setShowEditCustomerDialog(false);
        setSelectedEditCustomer(null);
        setCustomerForm({ name: "", email: "", phone: "" });
        await Promise.all([
          loadDashboardSummary({ silent: true }),
          loadDashboardDetails({ silent: true }),
          loadDashboardOrders({ silent: true }),
        ]);
        toast.success(`Customer "${customer.name}" updated successfully!`);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Customer could not be updated.",
        );
      });
  };

  const handleDeleteCustomer = (customer: Customer) => {
    if (!canMutateCatalog) {
      toast.info(
        "Customer updates are read-only for connected databases right now.",
      );
      return;
    }

    api
      .deleteDashboardCustomer(customer.id)
      .then(async ({ customer: deleted }) => {
        await Promise.all([
          loadDashboardSummary({ silent: true }),
          loadDashboardDetails({ silent: true }),
          loadDashboardOrders({ silent: true }),
        ]);
        toast.success(`Customer "${deleted.name}" deleted successfully!`);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Customer could not be deleted.",
        );
      });
  };

  const handleSettings = () => {
    setShowSettingsDialog(true);
  };

  const totalCustomers = customers.length;
  const totalProductsSold = products.reduce((acc, p) => acc + p.sold, 0);

  const fallbackMetrics = [
    {
      title: "Today's Revenue",
      value: `Rs ${todayRevenue.toLocaleString()}`,
      change: "+12.5%",
      positive: true,
      icon: <IndianRupee className="h-4 w-4" />,
    },
    {
      title: "Today's Orders",
      value: todayOrders.toString(),
      change: "+8.2%",
      positive: true,
      icon: <ShoppingCart className="h-4 w-4" />,
    },
    {
      title: "Total Customers",
      value: totalCustomers.toString(),
      change: "+15.3%",
      positive: true,
      icon: <Users className="h-4 w-4" />,
    },
    {
      title: "Products Sold",
      value: totalProductsSold.toLocaleString(),
      change: "-2.1%",
      positive: false,
      icon: <Package className="h-4 w-4" />,
    },
  ];

  const fallbackTopProducts = [...products]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const fallbackRecentCustomers = [...customers].slice(0, 5);
  const fallbackOrders = orders;
  const catalogProducts =
    dashboardDetails?.available && dashboardDetails.products
      ? dashboardDetails.products
      : products;
  const catalogCustomers =
    dashboardDetails?.available && dashboardDetails.customers
      ? dashboardDetails.customers
      : customers;
  const inventoryProducts =
    dashboardDetails?.available &&
    dashboardDetails.inventory?.products
      ? dashboardDetails.inventory.products
      : products.filter((product) => product.stock > 0);
  const orderHistory =
    dashboardOrders?.available && dashboardOrders.orders
      ? dashboardOrders.orders
      : fallbackOrders;
  const orderableProducts = catalogProducts.filter(
    (product) => product.stock > 0,
  );
  const inventorySummary =
    dashboardDetails?.available && dashboardDetails.inventory
      ? dashboardDetails.inventory
      : {
          availableProducts: products.filter((product) => product.stock > 0)
            .length,
          lowStockItems: products.filter(
            (product) => product.stock > 0 && product.stock < 10,
          ).length,
          totalStockValue: products
            .filter((product) => product.stock > 0)
            .reduce(
              (total, product) => total + product.stock * product.price,
              0,
            ),
          products: products.filter((product) => product.stock > 0),
        };
  const isConnectedReadOnlySource = Boolean(
    currentConnection &&
      ["postgresql", "mysql", "oracle"].includes(
        currentConnection.databaseType,
      ),
  );
  const canMutateCatalog = !isConnectedReadOnlySource;
  const usingImplicitDemoDatabase =
    !currentConnection && dashboardDetails?.available;
  const connectionTypeLabel = currentConnection?.databaseType
    ? currentConnection.databaseType.toUpperCase()
    : usingImplicitDemoDatabase
      ? "SQLITE"
      : "Not Connected";
  const connectionStatusLabel = currentConnection
    ? currentConnection.isDemoConnection
      ? "Demo Database"
      : isConnectedReadOnlySource
        ? "Connected (Read Only)"
        : "Connected"
    : usingImplicitDemoDatabase
      ? "Demo Database"
      : "Not Connected";
  const connectionNameLabel = currentConnection
    ? currentConnection.databaseType === "sqlite"
      ? currentConnection.filePath || currentConnection.databaseName || "SQLite"
      : [
          currentConnection.host,
          currentConnection.port,
          currentConnection.databaseName,
        ]
          .filter(Boolean)
          .join(" / ")
    : usingImplicitDemoDatabase
      ? "demo-retail-analytics.sqlite"
      : "No active source";
  const salesData = dashboardSummary?.available && dashboardSummary.salesData
    ? dashboardSummary.salesData
    : isDemoUser ? fallbackSalesData : [];
  const categoryData =
    dashboardSummary?.available && dashboardSummary.categoryData
      ? dashboardSummary.categoryData
      : isDemoUser ? fallbackCategoryData : [];
  const metrics =
    dashboardSummary?.available && dashboardSummary.metrics
      ? dashboardSummary.metrics.map((metric) => ({
          ...metric,
          icon:
            metric.key === "revenue" ? (
              <IndianRupee className="h-4 w-4" />
            ) : metric.key === "orders" ? (
              <ShoppingCart className="h-4 w-4" />
            ) : metric.key === "customers" ? (
              <Users className="h-4 w-4" />
            ) : (
              <Package className="h-4 w-4" />
            ),
        }))
      : isDemoUser ? fallbackMetrics : fallbackMetrics.map(metric => ({ ...metric, value: "—", change: "—" }));
  const topProducts =
    dashboardSummary?.available && dashboardSummary.topProducts
      ? dashboardSummary.topProducts
      : fallbackTopProducts;
  const recentCustomers =
    dashboardSummary?.available && dashboardSummary.recentCustomers
      ? dashboardSummary.recentCustomers
      : fallbackRecentCustomers;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r bg-muted/20">
        <div className="p-6 border-b">
          <Logo iconClassName="h-6 w-6" className="mb-4" onClick={onNavigateToLanding} clickable={!!onNavigateToLanding} />
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{businessName}</p>
              <p className="text-sm text-muted-foreground">
                {isDemoUser ? "Demo Workspace" : "Customer Workspace"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {posEnabled ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">POS Connected</p>
                    <p className="text-xs text-muted-foreground">Live sync active</p>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">POS Offline</p>
                    <p className="text-xs text-muted-foreground">Manual mode</p>
                  </div>
                </>
              )}
            </div>
            <Button
              variant={posEnabled ? "default" : "outline"}
              size="sm"
              onClick={togglePosSystem}
            >
              <Zap className="h-3 w-3 mr-1" />
              {posEnabled ? "On" : "Off"}
            </Button>
          </div>
        </div>

        <div className="p-6 border-b">
          <h3 className="font-medium mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Button
              onClick={onNavigateToChat}
              size="sm"
              className="w-full justify-start"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask Aska
            </Button>
            <Button
              onClick={() => setShowNewOrderDialog(true)}
              size="sm"
              variant="outline"
              className="w-full justify-start"
              disabled={!canMutateCatalog}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <h3 className="font-medium mb-3">Navigation</h3>
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start ${
                activeNavItem === "dashboard" ? "bg-accent shadow-sm" : "hover:bg-card/70"
              }`}
              onClick={() => handleNavigation("dashboard")}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start ${
                activeNavItem === "products" ? "bg-accent shadow-sm" : "hover:bg-card/70"
              }`}
              onClick={() => handleNavigation("products")}
            >
              <Package className="h-4 w-4 mr-2" />
              Products
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start ${
                activeNavItem === "customers" ? "bg-accent shadow-sm" : "hover:bg-card/70"
              }`}
              onClick={() => handleNavigation("customers")}
            >
              <Users className="h-4 w-4 mr-2" />
              Customers
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start ${
                activeNavItem === "orders" ? "bg-accent shadow-sm" : "hover:bg-card/70"
              }`}
              onClick={() => handleNavigation("orders")}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Orders
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start ${
                activeNavItem === "inventory" ? "bg-accent shadow-sm" : "hover:bg-card/70"
              }`}
              onClick={() => handleNavigation("inventory")}
            >
              <Database className="h-4 w-4 mr-2" />
              Inventory
            </Button>
          </div>
        </div>

        <div className="p-6 border-t space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onNavigateToSupport}
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Support
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSettings}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-auto">
        <div className="p-6 border-b bg-background">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">
                {activeNavItem === "dashboard" && "Dashboard"}
                {activeNavItem === "products" && "Products"}
                {activeNavItem === "customers" && "Customers"}
                {activeNavItem === "orders" && "Orders"}
                {activeNavItem === "inventory" && "Inventory"}
              </h1>
              <p className="text-muted-foreground">
                {activeNavItem === "dashboard" && "Welcome back! Here's what's happening with your store today."}
                {activeNavItem === "products" && "View and manage all your products"}
                {activeNavItem === "customers" && "Manage your customer relationships"}
                {activeNavItem === "orders" && "Track recent orders and customer purchases"}
                {activeNavItem === "inventory" && "Monitor stock levels and inventory"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isDashboardLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    isRefreshing || isDashboardLoading ? "animate-spin" : ""
                  }`}
                />
                {isDashboardLoading ? "Updating..." : "Refresh"}
              </Button>
              <Button>
                <Calendar className="h-4 w-4 mr-2" />
                Last 7 days
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {activeNavItem === "dashboard" && (
            <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric, index) => (
              <Card key={index} className="bg-card/92">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </CardTitle>
                  <div className="rounded-xl bg-secondary/80 p-2 text-foreground shadow-sm">
                    {metric.icon}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-3xl font-semibold tracking-tight">
                    {metric.value}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {metric.positive ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span
                      className={
                        metric.positive
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {metric.change}
                    </span>
                    <span>vs last week</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="bg-card/92">
              <CardHeader>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>
                  Daily revenue for the past week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [
                          `Rs ${value.toLocaleString()}`,
                        "Revenue",
                      ]}
                    />
                    <Bar dataKey="revenue" fill="#4f46e5" radius={[10, 10, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card/92">
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
                <CardDescription>
                  Revenue distribution across product categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        `${value}%`,
                        "Share",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {categoryData.map((category, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: category.color,
                          }}
                        />
                        <span className="text-sm">
                          {category.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        Rs {category.revenue.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="products" className="space-y-4">
            <TabsList className="rounded-xl bg-secondary/80 p-1">
              <TabsTrigger value="products">
                Top Products
              </TabsTrigger>
              <TabsTrigger value="customers">
                Recent Customers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <Card className="bg-card/92">
                <CardHeader>
                  <CardTitle>Top Selling Products</CardTitle>
                  <CardDescription>
                    Your best performing products this week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Sold</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            {product.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {product.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            Rs {product.price.toLocaleString()}
                          </TableCell>
                          <TableCell>{product.sold}</TableCell>
                          <TableCell>
                            Rs {product.revenue.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{product.stock}</span>
                              {product.stock < 30 && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Low
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customers">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Customers</CardTitle>
                  <CardDescription>
                    Latest customer activity and orders
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Total Spent</TableHead>
                        <TableHead>Last Order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {customer.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {customer.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {customer.email}
                          </TableCell>
                          <TableCell>
                            {customer.orders}
                          </TableCell>
                          <TableCell>
                            Rs {customer.totalSpent.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {customer.lastOrder}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
            </>
          )}

          {activeNavItem === "products" && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Products Catalog</CardTitle>
                  <CardDescription>
                    All products that have been sold, regardless of current availability
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Units Sold</TableHead>
                      <TableHead>Revenue Generated</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category}</Badge>
                        </TableCell>
                        <TableCell>Rs {product.price.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{product.sold} sold</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          Rs {product.revenue.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {product.stock > 0 ? (
                            <Badge className="bg-green-600">
                              In Stock ({product.stock})
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              Out of Stock
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditProductDialog(product)}
                              disabled={!canMutateCatalog}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteProduct(product)}
                              disabled={!canMutateCatalog}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeNavItem === "customers" && (
            <Card>
              <CardHeader>
                <CardTitle>All Customers</CardTitle>
                <CardDescription>
                  Manage your customer base and relationships
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Last Order</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          {customer.name}
                        </TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{customer.orders} orders</Badge>
                        </TableCell>
                        <TableCell>Rs {customer.totalSpent.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {customer.lastOrder}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditCustomerDialog(customer)}
                              disabled={!canMutateCatalog}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteCustomer(customer)}
                              disabled={!canMutateCatalog}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeNavItem === "orders" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Recent Orders</CardTitle>
                    <CardDescription>
                      Order activity from your connected retail data source
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setShowNewOrderDialog(true)}
                    disabled={!canMutateCatalog}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Order
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {orderHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderHistory.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.id}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div>{order.customerName}</div>
                              <div className="text-xs text-muted-foreground">
                                {order.customerEmail}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{order.productName}</TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell>
                            Rs {order.total.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {order.date}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No orders yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Orders will appear here once they are created.
                    </p>
                    <Button
                      onClick={() => setShowNewOrderDialog(true)}
                      disabled={!canMutateCatalog}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Order
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeNavItem === "inventory" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Available Products
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {inventorySummary.availableProducts}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Currently in stock
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Low Stock Items
                    </CardTitle>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {inventorySummary.lowStockItems}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Need immediate restock
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Stock Value
                    </CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      Rs {inventorySummary.totalStockValue.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Available inventory value
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Available Inventory</CardTitle>
                      <CardDescription>
                        Products currently in stock and available for sale
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => setShowAddProductDialog(true)}
                      disabled={!canMutateCatalog}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {inventoryProducts.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Current Stock</TableHead>
                          <TableHead>Stock Value</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventoryProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">
                              {product.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{product.category}</Badge>
                            </TableCell>
                            <TableCell>Rs {product.price.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  product.stock < 10
                                    ? "destructive"
                                    : product.stock < 30
                                    ? "outline"
                                    : "default"
                                }
                              >
                                {product.stock} units
                              </Badge>
                            </TableCell>
                            <TableCell>
                              Rs {(product.stock * product.price).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {product.stock < 10 ? (
                                <Badge variant="destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Critical
                                </Badge>
                              ) : product.stock < 30 ? (
                                <Badge variant="outline">
                                  Low Stock
                                </Badge>
                              ) : (
                                <Badge className="bg-green-600">
                                  In Stock
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openStockDialog(product)}
                                disabled={!canMutateCatalog}
                              >
                                Adjust
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-medium mb-2">No products in stock</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        All products are currently out of stock
                      </p>
                      <Button
                        onClick={() => setShowAddProductDialog(true)}
                        disabled={!canMutateCatalog}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Product
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Add a new product to your inventory
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                placeholder="Enter product name"
                value={newProduct.name}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={newProduct.category}
                onValueChange={(value) =>
                  setNewProduct({ ...newProduct, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mobile Phones">Mobile Phones</SelectItem>
                  <SelectItem value="Laptops">Laptops</SelectItem>
                  <SelectItem value="Televisions">Televisions</SelectItem>
                  <SelectItem value="Audio Devices">Audio Devices</SelectItem>
                  <SelectItem value="Computer Accessories">Computer Accessories</SelectItem>
                  <SelectItem value="Mobile Accessories">Mobile Accessories</SelectItem>
                  <SelectItem value="Printers & Scanners">Printers & Scanners</SelectItem>
                  <SelectItem value="Smart Watches">Smart Watches</SelectItem>
                  <SelectItem value="Cameras">Cameras</SelectItem>
                  <SelectItem value="Gaming">Gaming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (Rs)</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  placeholder="0"
                  value={newProduct.stock}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, stock: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddProductDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={!canMutateCatalog}
            >
              Add Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditProductDialog}
        onOpenChange={setShowEditProductDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the selected product details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editProductName">Product Name</Label>
              <Input
                id="editProductName"
                placeholder="Enter product name"
                value={newProduct.name}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCategory">Category</Label>
              <Select
                value={newProduct.category}
                onValueChange={(value) =>
                  setNewProduct({ ...newProduct, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mobile Phones">Mobile Phones</SelectItem>
                  <SelectItem value="Laptops">Laptops</SelectItem>
                  <SelectItem value="Televisions">Televisions</SelectItem>
                  <SelectItem value="Audio Devices">Audio Devices</SelectItem>
                  <SelectItem value="Computer Accessories">Computer Accessories</SelectItem>
                  <SelectItem value="Mobile Accessories">Mobile Accessories</SelectItem>
                  <SelectItem value="Printers & Scanners">Printers & Scanners</SelectItem>
                  <SelectItem value="Smart Watches">Smart Watches</SelectItem>
                  <SelectItem value="Cameras">Cameras</SelectItem>
                  <SelectItem value="Gaming">Gaming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editPrice">Price (Rs)</Label>
                <Input
                  id="editPrice"
                  type="number"
                  placeholder="0"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editStock">Stock</Label>
                <Input
                  id="editStock"
                  type="number"
                  placeholder="0"
                  value={newProduct.stock}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, stock: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditProductDialog(false);
                setSelectedEditProduct(null);
                setNewProduct({ name: "", category: "", price: "", stock: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditProduct}
              disabled={!canMutateCatalog}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditCustomerDialog}
        onOpenChange={setShowEditCustomerDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editCustomerName">Customer Name</Label>
              <Input
                id="editCustomerName"
                value={customerForm.name}
                onChange={(event) =>
                  setCustomerForm({
                    ...customerForm,
                    name: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCustomerEmail">Email</Label>
              <Input
                id="editCustomerEmail"
                type="email"
                value={customerForm.email}
                onChange={(event) =>
                  setCustomerForm({
                    ...customerForm,
                    email: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCustomerPhone">Phone</Label>
              <Input
                id="editCustomerPhone"
                value={customerForm.phone}
                onChange={(event) =>
                  setCustomerForm({
                    ...customerForm,
                    phone: event.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditCustomerDialog(false);
                setSelectedEditCustomer(null);
                setCustomerForm({ name: "", email: "", phone: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditCustomer}
              disabled={!canMutateCatalog}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewOrderDialog} onOpenChange={setShowNewOrderDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Order</DialogTitle>
            <DialogDescription>
              Create a new order and optionally add a new customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border-2">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">New Customer</p>
                  <p className="text-xs text-muted-foreground">
                    {newOrder.isNewCustomer 
                      ? "Adding a new customer with this order" 
                      : "Select from existing customers"}
                  </p>
                </div>
              </div>
              <Switch
                checked={newOrder.isNewCustomer}
                onCheckedChange={(checked) => setNewOrder({ 
                  ...newOrder, 
                  isNewCustomer: checked,
                  customerId: "",
                  customerName: "",
                  customerEmail: "",
                  customerPhone: "",
                })}
              />
            </div>

            {!newOrder.isNewCustomer && (
              <div className="space-y-2">
                <Label htmlFor="orderCustomer">Select Customer</Label>
                <Select
                  value={newOrder.customerId}
                  onValueChange={(value) =>
                    setNewOrder({ ...newOrder, customerId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogCustomers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {newOrder.isNewCustomer && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newCustomerName">Customer Name</Label>
                  <Input
                    id="newCustomerName"
                    placeholder="Enter customer name"
                    value={newOrder.customerName}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, customerName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newCustomerEmail">Email</Label>
                  <Input
                    id="newCustomerEmail"
                    type="email"
                    placeholder="customer@dukaan.in"
                    value={newOrder.customerEmail}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, customerEmail: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newCustomerPhone">Phone Number (Optional)</Label>
                  <Input
                    id="newCustomerPhone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={newOrder.customerPhone}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, customerPhone: e.target.value })
                    }
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="orderProduct">Product</Label>
              <Select
                value={newOrder.productId}
                onValueChange={(value) =>
                  setNewOrder({ ...newOrder, productId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {orderableProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - Rs {product.price.toLocaleString()} (Stock: {product.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="1"
                min="1"
                value={newOrder.quantity}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, quantity: e.target.value })
                }
              />
            </div>

            {newOrder.productId && newOrder.quantity && (
              <div className="p-4 bg-muted rounded-lg border-2 border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Order Total:</span>
                  <span className="text-2xl font-bold">
                    Rs{" "}
                    {(
                      (catalogProducts.find((p) => p.id === newOrder.productId)
                        ?.price || 0) * parseInt(newOrder.quantity || "1")
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewOrderDialog(false);
                setNewOrder({ 
                  isNewCustomer: false,
                  customerId: "", 
                  customerName: "",
                  customerEmail: "",
                  customerPhone: "",
                  productId: "", 
                  quantity: "1" 
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleNewOrder}
              disabled={!canMutateCatalog}
            >
              {newOrder.isNewCustomer ? "Add Customer & Create Order" : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Update the current stock level for this product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border p-4">
              <div className="font-medium">
                {selectedStockProduct?.name || "Selected product"}
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedStockProduct?.category || ""}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stockAdjustment">Stock Level</Label>
              <Input
                id="stockAdjustment"
                type="number"
                min="0"
                value={stockAdjustmentValue}
                onChange={(event) =>
                  setStockAdjustmentValue(event.target.value)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowStockDialog(false);
                setSelectedStockProduct(null);
                setStockAdjustmentValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStock}
              disabled={!canMutateCatalog}
            >
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your account and application settings
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="account" className="py-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="database">Database</TabsTrigger>
              <TabsTrigger value="pos">POS System</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>
            <TabsContent value="account" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shopName">Shop Name</Label>
                <Input id="shopName" defaultValue={businessName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner Name</Label>
                <Input id="ownerName" defaultValue={ownerName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settingsEmail">Email</Label>
                <Input
                  id="settingsEmail"
                  type="email"
                  defaultValue={currentUser.email || ""}
                />
              </div>
            </TabsContent>
            <TabsContent value="database" className="space-y-4">
              <div className="space-y-2">
                <Label>Database Type</Label>
                <Input disabled value={connectionTypeLabel} />
              </div>
              <div className="space-y-2">
                <Label>Connection Status</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={currentConnection ? "default" : "secondary"}
                    className={currentConnection ? "bg-green-600" : ""}
                  >
                    {connectionStatusLabel}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {connectionNameLabel}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRefresh}
              >
                Reconnect Database
              </Button>
            </TabsContent>
            <TabsContent value="pos" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {posEnabled ? (
                      <Wifi className="h-5 w-5 text-green-600" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">POS System Integration</p>
                      <p className="text-sm text-muted-foreground">
                        {posEnabled 
                          ? "Automatically sync sales from POS terminal"
                          : "Enable to sync transactions in real-time"
                        }
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={posEnabled ? "default" : "outline"}
                    onClick={togglePosSystem}
                  >
                    {posEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label>POS Terminal ID</Label>
                  <Input disabled value="TERM-2024-001" />
                </div>
                
                <div className="space-y-2">
                  <Label>Sync Status</Label>
                  <div className="flex items-center gap-2">
                    {posEnabled ? (
                      <>
                        <Badge variant="default" className="bg-green-600">
                          Live Sync Active
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Last sync: Just now
                        </span>
                      </>
                    ) : (
                      <Badge variant="secondary">
                        Manual Mode
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-600" />
                    <p className="font-medium text-sm">How POS Integration Works</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When enabled, transactions from your POS terminal automatically update inventory, revenue, and customer data in real-time. New customers are automatically added to your database.
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="notifications" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email updates about your orders
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Low Stock Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when products are low in stock
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sales Reports</p>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly sales summary reports
                  </p>
                </div>
                <input type="checkbox" className="w-4 h-4" />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSettingsDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Settings saved successfully!");
                setShowSettingsDialog(false);
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
