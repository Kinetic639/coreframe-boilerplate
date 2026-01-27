# Subscription-Based Context System

## Overview

The Subscription-Based Context System implements progressive feature unlocking tied to business modules and subscription tiers. This creates a natural path for users to grow from simple inventory management to sophisticated multi-channel commerce platforms, paying only for the complexity they need.

## Core Concept

**Context Visibility = Subscription Level**

Instead of overwhelming users with all available business contexts (warehouse, ecommerce, B2B, POS, manufacturing), the system dynamically shows only contexts that match their current subscription tier and enabled modules.

## Architecture Design

### Module-Context Mapping

```typescript
const MODULE_CONTEXTS = {
  warehouse: {
    module: "core",
    tier: "starter",
    description: "Internal inventory management",
    features: ["stock tracking", "location management", "basic reporting"],
  },
  ecommerce: {
    module: "ecommerce",
    tier: "professional",
    description: "Online store product management",
    features: ["pricing", "SEO data", "product images", "variants"],
  },
  b2b: {
    module: "b2b",
    tier: "business",
    description: "Business client catalog",
    features: ["client-specific pricing", "bulk orders", "custom catalogs"],
  },
  pos: {
    module: "pos",
    tier: "business",
    description: "Point of sale integration",
    features: ["quick access", "simplified views", "barcode scanning"],
  },
  manufacturing: {
    module: "manufacturing",
    tier: "enterprise",
    description: "Production and assembly",
    features: ["BOM management", "production orders", "component tracking"],
  },
};
```

### Subscription Tiers

#### **Starter** (Free/Basic)

- **Contexts**: `warehouse` only
- **Target**: Small businesses, freelancers, startups
- **Use Cases**: Basic inventory tracking, simple stock management
- **Features**: Core product CRUD, basic variant management, location tracking

#### **Professional** ($29/month)

- **Contexts**: `warehouse` + `ecommerce`
- **Target**: Online retailers, service businesses going digital
- **Use Cases**: E-commerce product management, online catalog
- **Features**: + Product pricing, SEO optimization, image management, public APIs

#### **Business** ($79/month)

- **Contexts**: `warehouse` + `ecommerce` + `b2b` + `pos`
- **Target**: Established businesses with multiple sales channels
- **Use Cases**: B2B sales, retail operations, multi-channel commerce
- **Features**: + Client-specific pricing, POS integration, advanced reporting

#### **Enterprise** ($199/month)

- **Contexts**: All system contexts + custom contexts
- **Target**: Large organizations, manufacturers, complex operations
- **Use Cases**: Full supply chain management, custom workflows
- **Features**: + Manufacturing, custom contexts, advanced API access, unlimited integrations

## Database Schema Enhancements

### Organizations Table

```sql
ALTER TABLE organizations
ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'starter',
ADD COLUMN enabled_modules JSONB DEFAULT '["warehouse"]'::jsonb,
ADD COLUMN subscription_expires_at TIMESTAMPTZ,
ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'active',
ADD COLUMN custom_context_limit INTEGER DEFAULT 0;
```

### Context Configurations Table

```sql
ALTER TABLE context_configurations
ADD COLUMN required_module VARCHAR(50) DEFAULT 'core',
ADD COLUMN subscription_tier_minimum VARCHAR(20) DEFAULT 'starter',
ADD COLUMN is_premium_feature BOOLEAN DEFAULT false;
```

### Module Permissions Table

```sql
CREATE TABLE module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  module_name VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  enabled_by UUID REFERENCES auth.users(id),
  features_enabled JSONB DEFAULT '{}'::jsonb,
  usage_limits JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Implementation Details

### Enhanced Context Service

```typescript
export class ContextService {
  /**
   * Get available contexts based on organization subscription
   */
  async getAvailableContexts(organizationId: string): Promise<{
    available: Context[];
    locked: ContextWithUpgradeInfo[];
  }> {
    try {
      // Get organization subscription info
      const org = await this.getOrganizationSubscription(organizationId);
      const enabledModules = org.enabled_modules || ["warehouse"];
      const tier = org.subscription_tier || "starter";

      // Get all contexts
      const allContexts = await this.getAllSystemContexts();

      // Separate available vs locked
      const available = allContexts.filter((context) =>
        this.isContextAvailable(context, enabledModules, tier)
      );

      const locked = allContexts
        .filter((context) => !this.isContextAvailable(context, enabledModules, tier))
        .map((context) => this.enrichWithUpgradeInfo(context));

      return { available, locked };
    } catch (error) {
      console.error("Error getting available contexts:", error);
      throw error;
    }
  }

  /**
   * Check if context is available for current subscription
   */
  private isContextAvailable(context: Context, enabledModules: string[], tier: string): boolean {
    // Core module always available
    if (context.required_module === "core") return true;

    // Check if module is enabled
    if (!enabledModules.includes(context.required_module)) return false;

    // Check if tier supports this context
    const tierHierarchy = ["starter", "professional", "business", "enterprise"];
    const currentTierIndex = tierHierarchy.indexOf(tier);
    const requiredTierIndex = tierHierarchy.indexOf(context.subscription_tier_minimum);

    return currentTierIndex >= requiredTierIndex;
  }

  /**
   * Add upgrade information to locked contexts
   */
  private enrichWithUpgradeInfo(context: Context): ContextWithUpgradeInfo {
    const upgradeInfo = this.getUpgradeInfo(context.required_module);
    return {
      ...context,
      upgradeInfo: {
        requiredTier: context.subscription_tier_minimum,
        requiredModule: context.required_module,
        pricing: upgradeInfo.pricing,
        features: upgradeInfo.features,
        upgradeUrl: `/subscription/upgrade?module=${context.required_module}`,
      },
    };
  }
}
```

### Enhanced Context Switcher UI

```tsx
export function ContextSwitcher({ variant = "tabs", onContextChange }: ContextSwitcherProps) {
  const { availableContexts, lockedContexts, isLoading } = useAvailableContexts();
  const [showUpgradeModal, setShowUpgradeModal] = React.useState<Context | null>(null);

  return (
    <div className="space-y-4">
      {/* Available Contexts */}
      <div className="flex flex-wrap items-center gap-2">
        {availableContexts.map((context) => (
          <ContextButton
            key={context.id}
            context={context}
            isActive={currentContext === context.context_name}
            onClick={() => onContextChange?.(context.context_name)}
          />
        ))}
      </div>

      {/* Locked Contexts with Upgrade Prompts */}
      {lockedContexts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Unlock more contexts with a subscription upgrade
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {lockedContexts.map((context) => (
              <LockedContextButton
                key={context.id}
                context={context}
                onClick={() => setShowUpgradeModal(context)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        context={showUpgradeModal}
        open={!!showUpgradeModal}
        onOpenChange={() => setShowUpgradeModal(null)}
      />
    </div>
  );
}

function LockedContextButton({ context, onClick }: LockedContextButtonProps) {
  const IconComponent = getContextIcon(context.context_name);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="relative border-dashed opacity-60 hover:opacity-100 transition-opacity"
    >
      <div className="flex items-center gap-2">
        <IconComponent className="h-3 w-3" />
        <span className="text-xs">{getContextLabel(context)}</span>
        <Lock className="h-3 w-3" />
      </div>
      <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 px-1 text-xs">
        {context.upgradeInfo.requiredTier}
      </Badge>
    </Button>
  );
}
```

### Upgrade Modal Component

```tsx
function UpgradeModal({ context, open, onOpenChange }: UpgradeModalProps) {
  if (!context) return null;

  const { upgradeInfo } = context;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <getContextIcon(context.context_name) className="h-5 w-5" />
            Unlock {getContextLabel(context)}
          </DialogTitle>
          <DialogDescription>
            Upgrade to {upgradeInfo.requiredTier} to access {context.context_name} features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium mb-2">What you'll get:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {upgradeInfo.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <div className="font-medium">{upgradeInfo.requiredTier} Plan</div>
              <div className="text-sm text-muted-foreground">
                Everything in your current plan, plus {context.context_name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">${upgradeInfo.pricing.monthly}</div>
              <div className="text-xs text-muted-foreground">per month</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button onClick={() => window.open(upgradeInfo.upgradeUrl, '_blank')}>
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## User Journey Examples

### Small Restaurant (Starter Tier)

**Current State**:

- Only warehouse context visible
- Manages ingredients, supplies
- Simple inventory tracking

**Growth Trigger**:

- Wants to offer online ordering
- Sees "Unlock E-commerce" in context switcher

**Upgrade Experience**:

1. Clicks locked e-commerce context
2. Sees upgrade modal with online ordering features
3. Upgrades to Professional ($29/month)
4. E-commerce context immediately appears
5. Can now manage online menu with pricing

### Growing Retailer (Professional Tier)

**Current State**:

- Warehouse + E-commerce contexts
- Online store operational
- Basic product catalog

**Growth Trigger**:

- Starts selling to other businesses
- Needs different pricing for bulk orders

**Upgrade Experience**:

1. Sees locked B2B context
2. Learns about wholesale features
3. Upgrades to Business ($79/month)
4. Unlocks B2B + POS contexts
5. Can now manage wholesale catalogs and retail POS

### Manufacturing Company (Enterprise Tier)

**Current State**:

- All standard contexts available
- Complex multi-channel operations

**Growth Trigger**:

- Needs custom workflow for quality control
- Requires specialized contexts

**Upgrade Experience**:

1. Can create custom contexts
2. Configures quality control context
3. Sets up specialized workflows
4. Manages complex supply chain operations

## Business Impact

### Revenue Optimization

#### **Conversion Funnel**:

1. **Starter**: Free trial → Basic inventory needs satisfied
2. **Professional**: E-commerce needs → Clear value proposition
3. **Business**: Multi-channel needs → Advanced features
4. **Enterprise**: Custom needs → Unlimited flexibility

#### **Pricing Psychology**:

- **Anchoring**: Enterprise tier makes Business tier seem reasonable
- **Loss Aversion**: Users see locked features they "could have"
- **Progressive Commitment**: Each upgrade increases switching cost
- **Value Perception**: Features unlock immediately with clear benefits

### User Experience Benefits

#### **Cognitive Load Reduction**:

- New users see minimal interface
- No overwhelming feature discovery
- Clear upgrade path visibility

#### **Progressive Disclosure**:

- Features appear when needed
- Natural business growth alignment
- No feature abandonment

#### **Immediate Gratification**:

- Instant feature access upon upgrade
- No waiting for activation
- Clear value demonstration

## Technical Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Database schema updates
- [ ] Enhanced ContextService with subscription checking
- [ ] Basic UI updates for locked contexts

### Phase 2: UI Enhancement (Week 3-4)

- [ ] Upgrade modal components
- [ ] Enhanced context switcher with locked states
- [ ] Subscription management interface

### Phase 3: Integration (Week 5-6)

- [ ] Payment processing integration
- [ ] Subscription lifecycle management
- [ ] Usage analytics and tracking

### Phase 4: Advanced Features (Week 7-8)

- [ ] Custom context creation for Enterprise
- [ ] Advanced usage limits and throttling
- [ ] Subscription analytics dashboard

## Success Metrics

### **User Metrics**:

- Context usage patterns per tier
- Upgrade conversion rates
- Feature adoption rates
- User retention by subscription tier

### **Business Metrics**:

- Monthly Recurring Revenue (MRR) growth
- Average Revenue Per User (ARPU)
- Customer Lifetime Value (CLV)
- Churn rate by subscription tier

### **Product Metrics**:

- Feature discovery rates
- Time to value for new contexts
- Support tickets by subscription tier
- Feature request patterns

## Risk Mitigation

### **User Experience Risks**:

- **Risk**: Users frustrated by locked features
- **Mitigation**: Clear value proposition, generous free tier

### **Technical Risks**:

- **Risk**: Complex subscription state management
- **Mitigation**: Robust state caching, fallback mechanisms

### **Business Risks**:

- **Risk**: Users avoiding upgrades
- **Mitigation**: Value-based pricing, clear upgrade benefits

This subscription-based context system creates a natural monetization model that aligns business growth with product complexity, ensuring users pay for value while maintaining a simple, approachable starting experience.
