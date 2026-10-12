import type { ReactNode } from "react";
import { BarChart3, Database, HelpCircle, LogOut, MessageSquare, Package, Settings, ShoppingCart, Users, ArrowUpRight } from "lucide-react";
import { Logo } from "./Logo";
import "../styles/workspace.css";
interface WorkspaceSidebarProps {
  businessName: string;
  initials: string;
  isDemo: boolean;
  active: string;
  onHome?: () => void;
  onChat?: () => void;
  onNavigate: (page: string) => void;
  onSupport: () => void;
  onSettings: () => void;
  onLogout: () => void;
  suggestions?: string[];
  onQuestion?: (question: string) => void;
  children?: ReactNode;
  mobile?: boolean;
}
const pages = [
  { id: "dashboard", label: "Overview", icon: BarChart3 },
  { id: "products", label: "Products", icon: Package },
  { id: "customers", label: "Customers", icon: Users },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Database },
];
export function WorkspaceSidebar({ businessName, initials, isDemo, active, onHome, onChat, onNavigate, onSupport, onSettings, onLogout, suggestions, onQuestion, children, mobile = false }: WorkspaceSidebarProps) {
  return <aside className={`workspace-sidebar ${mobile ? "workspace-sidebar-mobile" : ""}`}>
    <div className="workspace-brand"><Logo iconClassName="h-7 w-7" onClick={onHome}/></div>
    <div className="workspace-account"><div className="workspace-initials">{initials}</div><div><strong>{businessName}</strong><span><i/>{isDemo ? "Demo workspace" : "Your workspace"}</span></div></div>
    <nav aria-label="Workspace navigation" className="workspace-navigation">
      <button className={active === "chat" ? "active" : ""} aria-current={active === "chat" ? "page" : undefined} onClick={onChat}><MessageSquare size={17}/><span>Aska Chat</span></button>
      {(suggestions ? pages.slice(0,1) : pages).map(({id,label,icon:Icon}) => <button key={id} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} onClick={() => onNavigate(id)}><Icon size={17}/><span>{label}</span></button>)}
    </nav>
    {children && <div className="workspace-sidebar-tools">{children}</div>}
    {suggestions && <div className="workspace-suggestions"><span className="workspace-section-label">Suggested questions</span>{suggestions.map(question => <button key={question} onClick={() => onQuestion?.(question)}>{question}<ArrowUpRight size={13}/></button>)}</div>}
    <div className="workspace-sidebar-bottom"><button onClick={onSupport}><HelpCircle size={17}/>Help & support</button><button onClick={onSettings}><Settings size={17}/>Settings</button><button onClick={onLogout}><LogOut size={17}/>Sign out</button></div>
  </aside>;
}
