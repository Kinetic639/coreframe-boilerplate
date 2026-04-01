# Sidebar Navigation Structure - CoreFrame WMS/VMI Application

## Overview

This document defines the complete sidebar navigation structure for the CoreFrame application. The sidebar uses a hierarchical, collapsible menu system where modules are organized into expandable groups with nested navigation links.

## Complete Navigation Structure

### Visual Tree Representation

```
CoreFrame WMS (Logo)
│
├─ Home                                           → /dashboard/start
│
├─ Warehouse                                      [EXPANDABLE GROUP]
│  ├─ Inventory                                   [SUBMENU]
│  │  ├─ Movements                                → /dashboard/warehouse/inventory/movements
│  │  ├─ Products                                 → /dashboard/warehouse/products
│  │  ├─ Locations                                → /dashboard/warehouse/locations
│  │  ├─ Labels                                   → /dashboard/warehouse/labels
│  │  ├─ Alerts                                   → /dashboard/warehouse/alerts
│  │  └─ Adjustments                              [SUBMENU]
│  │     ├─ Audits                                → /dashboard/warehouse/audits
│  │     └─ Adjustments                           → /dashboard/warehouse/inventory/adjustments
│  ├─ Sales                                       [SUBMENU]
│  │  ├─ Sales Orders                             → /dashboard/warehouse/sales-orders
│  │  └─ Clients                                  → /dashboard/warehouse/clients
│  ├─ Purchases                                   [SUBMENU]
│  │  ├─ Purchase Orders                          → /dashboard/warehouse/purchases
│  │  ├─ Deliveries                               → /dashboard/warehouse/deliveries
│  │  ├─ Suppliers                                → /dashboard/warehouse/suppliers/list
│  │  └─ Scan Delivery                            → /dashboard/warehouse/scanning/delivery
│  └─ Settings                                    → /dashboard/warehouse/settings
│
├─ Teams                                          [EXPANDABLE GROUP]
│  ├─ Organization Contacts                       → /dashboard/teams/contacts
│  ├─ Communication                               [SUBMENU]
│  │  ├─ Chat                                     → /dashboard/teams/communication/chat
│  │  └─ Announcements                            → /dashboard/announcements
│  ├─ Kanban                                      → /dashboard/teams/kanban
│  └─ Calendar                                    → /dashboard/teams/calendar
│
├─ Organization                                   [EXPANDABLE GROUP]
│  ├─ Profile                                     → /dashboard/organization/profile
│  ├─ Branches                                    → /dashboard/organization/branches
│  ├─ Users                                       [SUBMENU]
│  │  ├─ User List                                → /dashboard/organization/users/list
│  │  ├─ Invitations                              → /dashboard/organization/users/invitations
│  │  └─ Roles                                    → /dashboard/organization/users/roles
│  └─ Billing                                     → /dashboard/organization/billing
│
└─ Support                                        [EXPANDABLE GROUP]
   ├─ Help Center                                 → /dashboard/support/help
   ├─ Contact Support                             → /dashboard/support/contact
   └─ Announcements                               [SUBMENU]
      ├─ Changelog                                → /dashboard/support/announcements/changelog
      ├─ System Status                            → /dashboard/support/announcements/status
      └─ Roadmap                                  → /dashboard/support/announcements/roadmap
```

## Detailed Module Structure

### 1. Home (Non-expandable)

**Icon**: `Home` from Lucide
**Route**: `/dashboard/start`
**Always Visible**: Yes

---

### 2. Warehouse Module

**Icon**: `Warehouse` from Lucide
**Expandable**: Yes (default: expanded)

#### Sub-navigation Items:

##### 2.1 Inventory (Submenu Group)

**Icon**: `Archive`
**Parent Path**: `/dashboard/warehouse/inventory`

Sub-items:

1. **Movements**
   - **Route**: `/dashboard/warehouse/inventory/movements`
   - **Icon**: `ArrowRightLeft`

2. **Products**
   - **Route**: `/dashboard/warehouse/products`
   - **Icon**: `Package`

3. **Locations**
   - **Route**: `/dashboard/warehouse/locations`
   - **Icon**: `MapPin`

4. **Labels**
   - **Route**: `/dashboard/warehouse/labels`
   - **Icon**: `QrCode`

5. **Alerts**
   - **Route**: `/dashboard/warehouse/alerts`
   - **Icon**: `AlertTriangle`

6. **Adjustments** (Nested Submenu)
   **Icon**: `Settings`
   **Parent Path**: `/dashboard/warehouse/inventory/adjustments`

   Sub-items:
   - **Audits**
     - **Route**: `/dashboard/warehouse/audits`
     - **Icon**: `ClipboardCheck`

   - **Adjustments**
     - **Route**: `/dashboard/warehouse/inventory/adjustments`
     - **Icon**: `Edit`

##### 2.2 Sales (Submenu Group)

**Icon**: `ShoppingCart`
**Parent Path**: `/dashboard/warehouse/sales`

Sub-items:

1. **Sales Orders**
   - **Route**: `/dashboard/warehouse/sales-orders`
   - **Icon**: `FileText`

2. **Clients**
   - **Route**: `/dashboard/warehouse/clients`
   - **Icon**: `Users`

##### 2.3 Purchases (Submenu Group)

**Icon**: `ShoppingBag`
**Parent Path**: `/dashboard/warehouse/purchases`

Sub-items:

1. **Purchase Orders**
   - **Route**: `/dashboard/warehouse/purchases`
   - **Icon**: `FileText`

2. **Deliveries**
   - **Route**: `/dashboard/warehouse/deliveries`
   - **Icon**: `Inbox`

3. **Suppliers**
   - **Route**: `/dashboard/warehouse/suppliers/list`
   - **Icon**: `Truck`

4. **Scan Delivery**
   - **Route**: `/dashboard/warehouse/scanning/delivery`
   - **Icon**: `ScanLine`

##### 2.4 Settings

**Icon**: `Settings`
**Route**: `/dashboard/warehouse/settings`

---

### 3. Teams Module

**Icon**: `Users` from Lucide
**Expandable**: Yes (default: collapsed)

#### Sub-navigation Items:

1. **Organization Contacts**
   - **Route**: `/dashboard/teams/contacts`
   - **Icon**: `Building2`

2. **Communication** (Submenu Group)
   **Icon**: `MessageSquare`
   **Parent Path**: `/dashboard/teams/communication`

   Sub-items:
   - **Chat**
     - **Route**: `/dashboard/teams/communication/chat`
     - **Icon**: `MessageCircle`

   - **Announcements**
     - **Route**: `/dashboard/announcements`
     - **Icon**: `Megaphone`

3. **Kanban**
   - **Route**: `/dashboard/teams/kanban`
   - **Icon**: `Columns`

4. **Calendar**
   - **Route**: `/dashboard/teams/calendar`
   - **Icon**: `Calendar`

---

### 4. Organization Module

**Icon**: `Settings` from Lucide
**Expandable**: Yes (default: collapsed)

#### Sub-navigation Items:

1. **Profile**
   - **Route**: `/dashboard/organization/profile`
   - **Icon**: `Building2`
   - **Permission**: `organization.profile.update`

2. **Branches**
   - **Route**: `/dashboard/organization/branches`
   - **Icon**: `MapPin`
   - **Permission**: `branch.manage`

3. **Users** (Submenu Group)
   **Icon**: `Users`
   **Parent Path**: `/dashboard/organization/users`
   **Permission**: `user.manage`

   Sub-items:
   - **User List**
     - **Route**: `/dashboard/organization/users/list`
     - **Icon**: `List`
     - **Permission**: `user.manage`

   - **Invitations**
     - **Route**: `/dashboard/organization/users/invitations`
     - **Icon**: `Mail`
     - **Permission**: `invitation.read`

   - **Roles**
     - **Route**: `/dashboard/organization/users/roles`
     - **Icon**: `Shield`
     - **Permission**: `user.role.read`

4. **Billing**
   - **Route**: `/dashboard/organization/billing`
   - **Icon**: `CreditCard`

---

### 5. Support Module

**Icon**: `LifeBuoy` from Lucide
**Expandable**: Yes (default: collapsed)

#### Sub-navigation Items:

1. **Help Center**
   - **Route**: `/dashboard/support/help`
   - **Icon**: `LifeBuoy`

2. **Contact Support**
   - **Route**: `/dashboard/support/contact`
   - **Icon**: `MessageSquare`

3. **Announcements** (Submenu Group)
   **Icon**: `Megaphone`
   **Parent Path**: `/dashboard/support/announcements`

   Sub-items:
   - **Changelog**
     - **Route**: `/dashboard/support/announcements/changelog`
     - **Icon**: `History`

   - **System Status**
     - **Route**: `/dashboard/support/announcements/status`
     - **Icon**: `BarChart`

   - **Roadmap**
     - **Route**: `/dashboard/support/announcements/roadmap`
     - **Icon**: `Map`

---

## Implementation Structure

### Component Hierarchy

```typescript
<Sidebar>
  <SidebarHeader>
    <Logo />
    <OrganizationSelector />
    <BranchSelector />
  </SidebarHeader>

  <SidebarNav> {/* Scrollable */}
    <SidebarNavItem href="/dashboard/start" icon={Home}>
      Home
    </SidebarNavItem>

    <SidebarNavGroup
      title="Warehouse"
      icon={Warehouse}
      defaultExpanded={true}
    >
      <SidebarNavSubmenu title="Inventory" icon={Archive}>
        <SidebarNavItem href="/dashboard/warehouse/inventory/movements" icon={ArrowRightLeft}>
          Movements
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/warehouse/products" icon={Package}>
          Products
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/warehouse/locations" icon={MapPin}>
          Locations
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/warehouse/labels" icon={QrCode}>
          Labels
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/warehouse/alerts" icon={AlertTriangle}>
          Alerts
        </SidebarNavItem>
        <SidebarNavSubmenu title="Adjustments" icon={Settings}>
          <SidebarNavItem href="/dashboard/warehouse/audits" icon={ClipboardCheck}>
            Audits
          </SidebarNavItem>
          <SidebarNavItem href="/dashboard/warehouse/inventory/adjustments" icon={Edit}>
            Adjustments
          </SidebarNavItem>
        </SidebarNavSubmenu>
      </SidebarNavSubmenu>

      <SidebarNavSubmenu title="Sales" icon={ShoppingCart}>
        <SidebarNavItem href="/dashboard/warehouse/sales-orders" icon={FileText}>
          Sales Orders
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/warehouse/clients" icon={Users}>
          Clients
        </SidebarNavItem>
      </SidebarNavSubmenu>

      <SidebarNavSubmenu title="Purchases" icon={ShoppingBag}>
        <SidebarNavItem href="/dashboard/warehouse/purchases" icon={FileText}>
          Purchase Orders
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/warehouse/deliveries" icon={Inbox}>
          Deliveries
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/warehouse/suppliers/list" icon={Truck}>
          Suppliers
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/warehouse/scanning/delivery" icon={ScanLine}>
          Scan Delivery
        </SidebarNavItem>
      </SidebarNavSubmenu>

      <SidebarNavItem href="/dashboard/warehouse/settings" icon={Settings}>
        Settings
      </SidebarNavItem>
    </SidebarNavGroup>

    <SidebarNavGroup title="Teams" icon={Users}>
      <SidebarNavItem href="/dashboard/teams/contacts" icon={Building2}>
        Organization Contacts
      </SidebarNavItem>
      <SidebarNavSubmenu title="Communication" icon={MessageSquare}>
        <SidebarNavItem href="/dashboard/teams/communication/chat" icon={MessageCircle}>
          Chat
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/announcements" icon={Megaphone}>
          Announcements
        </SidebarNavItem>
      </SidebarNavSubmenu>
      <SidebarNavItem href="/dashboard/teams/kanban" icon={Columns}>
        Kanban
      </SidebarNavItem>
      <SidebarNavItem href="/dashboard/teams/calendar" icon={Calendar}>
        Calendar
      </SidebarNavItem>
    </SidebarNavGroup>

    <SidebarNavGroup title="Organization" icon={Settings}>
      <SidebarNavItem href="/dashboard/organization/profile" icon={Building2}>
        Profile
      </SidebarNavItem>
      <SidebarNavItem href="/dashboard/organization/branches" icon={MapPin}>
        Branches
      </SidebarNavItem>
      <SidebarNavSubmenu title="Users" icon={Users}>
        <SidebarNavItem href="/dashboard/organization/users/list" icon={List}>
          User List
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/organization/users/invitations" icon={Mail}>
          Invitations
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/organization/users/roles" icon={Shield}>
          Roles
        </SidebarNavItem>
      </SidebarNavSubmenu>
      <SidebarNavItem href="/dashboard/organization/billing" icon={CreditCard}>
        Billing
      </SidebarNavItem>
    </SidebarNavGroup>

    <SidebarNavGroup title="Support" icon={LifeBuoy}>
      <SidebarNavItem href="/dashboard/support/help" icon={LifeBuoy}>
        Help Center
      </SidebarNavItem>
      <SidebarNavItem href="/dashboard/support/contact" icon={MessageSquare}>
        Contact Support
      </SidebarNavItem>
      <SidebarNavSubmenu title="Announcements" icon={Megaphone}>
        <SidebarNavItem href="/dashboard/support/announcements/changelog" icon={History}>
          Changelog
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/support/announcements/status" icon={BarChart}>
          System Status
        </SidebarNavItem>
        <SidebarNavItem href="/dashboard/support/announcements/roadmap" icon={Map}>
          Roadmap
        </SidebarNavItem>
      </SidebarNavSubmenu>
    </SidebarNavGroup>
  </SidebarNav>

  <SidebarFooter>
    <UserMenu>
      <UserAvatar />
      <UserInfo />
      <LogoutButton />
    </UserMenu>
  </SidebarFooter>
</Sidebar>
```

### State Management

```typescript
interface SidebarState {
  collapsed: boolean; // Sidebar collapsed/expanded
  expandedGroups: string[]; // Which module groups are expanded
  expandedSubmenus: string[]; // Which submenus are expanded
  activePath: string; // Current active route
}

// Persist in localStorage
const sidebarState = {
  collapsed: false,
  expandedGroups: ["warehouse"], // Warehouse expanded by default
  expandedSubmenus: ["inventory", "purchases"], // Common submenus expanded
  activePath: "/dashboard/warehouse/products",
};
```

## Permission-Based Rendering

Some navigation items require specific permissions:

### Organization Module Items:

- **Profile**: Requires `organization.profile.update`
- **Branches**: Requires `branch.manage`
- **Users (all)**: Requires `user.manage`
- **User List**: Requires `user.manage`
- **Invitations**: Requires `invitation.read`
- **Roles**: Requires `user.role.read`

Items without required permissions should be hidden from users who don't have access.

## Summary for AI Implementation

When implementing the sidebar navigation:

1. **Create hierarchical structure** with 5 main modules: Home (direct link), Warehouse (4 submenus with nested items), Teams (4 items with 1 submenu), Organization (4 items with 1 submenu), Support (3 items with 1 submenu)

2. **Use proper routing** with Next.js `Link` component for all navigation items

3. **Implement multi-level expand/collapse** functionality for module groups and nested submenus with state persistence

4. **Sync with URL** - active state should reflect current route, auto-expand parent groups

5. **Implement permission checks** - hide items that require permissions the user doesn't have

6. **Support nested navigation** - proper indentation and visual hierarchy for up to 3 levels deep

7. **Use icons from Lucide React** as specified in the structure above
