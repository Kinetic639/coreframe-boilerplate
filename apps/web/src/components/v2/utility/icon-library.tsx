import { LucideIcon, icons } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * IconLibrary - Dynamic icon rendering from lucide-react
 * Usage: <Icon name="User" size={24} className="text-primary" />
 */

interface IconProps {
  name: keyof typeof icons;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, className, strokeWidth }: IconProps) {
  const LucideIcon = icons[name] as LucideIcon;

  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }

  return <LucideIcon size={size} className={cn(className)} strokeWidth={strokeWidth} />;
}

// Export commonly used icons for convenience
export {
  User,
  Users,
  Settings,
  Search,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  Home,
  Mail,
  Phone,
  Calendar,
  Clock,
  MapPin,
  Edit,
  Trash2,
  Save,
  Upload,
  Download,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  LogIn,
  LogOut,
  FileText,
  File,
  Folder,
  Image,
  Video,
  Music,
  Package,
  ShoppingCart,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart,
  PieChart,
  Activity,
  Zap,
  Star,
  Heart,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Bell,
  BellOff,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  RotateCcw,
  Copy,
  Clipboard,
  ExternalLink,
  Link,
  Share2,
  MoreVertical,
  MoreHorizontal,
  Wifi,
  WifiOff,
  Database,
  Server,
  Cloud,
  CloudOff,
  Globe,
} from "lucide-react";

// Helper to list all available icons
export const getAvailableIcons = () => {
  return Object.keys(icons);
};

// Helper to search icons by name
export const searchIcons = (query: string) => {
  const lowerQuery = query.toLowerCase();
  return Object.keys(icons).filter((name) => name.toLowerCase().includes(lowerQuery));
};
