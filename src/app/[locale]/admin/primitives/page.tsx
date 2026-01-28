"use client";

import { z } from "zod";
import { FormWrapper } from "@/components/v2/forms/form-wrapper";
import { TextInput } from "@/components/v2/forms/text-input";
import { Textarea } from "@/components/v2/forms/textarea";
import { Select } from "@/components/v2/forms/select";
import { MultiSelect } from "@/components/v2/forms/multi-select";
import { DatePicker } from "@/components/v2/forms/date-picker";
import { FileUpload } from "@/components/v2/forms/file-upload";
import { CreateEditDialog } from "@/components/v2/forms/create-edit-dialog";
import { FilterForm } from "@/components/v2/forms/filter-form";
import { SearchForm } from "@/components/v2/forms/search-form";
import { StatusBar } from "@/components/v2/layout/status-bar";
import { Breadcrumbs } from "@/components/v2/layout/breadcrumbs";
import { MobileDrawer } from "@/components/v2/layout/mobile-drawer";
import { QuickSwitcher } from "@/components/v2/layout/quick-switcher";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";
import { ErrorBoundary } from "@/components/v2/feedback/error-boundary";
import { toastPatterns } from "@/components/v2/feedback/toast-patterns";
import { ConfirmationDialog } from "@/components/v2/feedback/confirmation-dialog";
import { ProgressIndicator } from "@/components/v2/feedback/progress-indicator";
import { CopyToClipboard } from "@/components/v2/utility/copy-to-clipboard";
import { Tooltip } from "@/components/v2/utility/tooltip";
import { Badge } from "@/components/v2/utility/badge";
import { Avatar } from "@/components/v2/utility/avatar";
import { Icon } from "@/components/v2/utility/icon-library";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const testSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string()),
  date: z.string(),
  files: z.any(),
});

export default function PrimitivesPage() {
  const [progress, setProgress] = useState(45);

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">UI Primitives Showcase</h1>
        <p className="text-muted-foreground mt-2">Preview of all Phase 2 v2 components</p>
      </div>

      {/* Form Primitives */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Form Primitives</h2>
          <p className="text-sm text-muted-foreground">
            Form components with validation using React Hook Form + Zod
          </p>
        </div>

        <div className="max-w-2xl border rounded-lg p-6">
          <FormWrapper
            schema={testSchema}
            onSubmit={async (data) => {
              console.log("Form data:", data);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }}
            defaultValues={{
              tags: [],
            }}
          >
            <TextInput name="name" label="Full Name" placeholder="John Doe" required />

            <TextInput
              name="email"
              label="Email Address"
              type="email"
              placeholder="john@example.com"
              required
              prefix={<Icon name="Mail" size={16} />}
            />

            <Textarea
              name="message"
              label="Message"
              placeholder="Enter your message..."
              required
              rows={4}
              maxLength={500}
            />

            <Select
              name="category"
              label="Category"
              placeholder="Select a category"
              required
              options={[
                { value: "bug", label: "Bug Report" },
                { value: "feature", label: "Feature Request" },
                { value: "question", label: "Question" },
              ]}
            />

            <MultiSelect
              name="tags"
              label="Tags"
              options={[
                { value: "urgent", label: "Urgent" },
                { value: "important", label: "Important" },
                { value: "low-priority", label: "Low Priority" },
              ]}
            />

            <DatePicker name="date" label="Preferred Date" placeholder="Select a date" />

            <FileUpload
              name="files"
              label="Attachments"
              accept="image/*,.pdf"
              multiple
              maxSize={5 * 1024 * 1024}
            />
          </FormWrapper>
        </div>

        <div className="flex gap-4">
          <CreateEditDialog
            mode="create"
            title="Create New Item"
            schema={z.object({ title: z.string().min(1) })}
            onSubmit={async (data) => {
              console.log("Created:", data);
              toastPatterns.created("Item");
            }}
          >
            <TextInput name="title" label="Title" required />
          </CreateEditDialog>

          <FilterForm
            schema={z.object({ search: z.string() })}
            onApply={(filters) => console.log("Filters:", filters)}
            onClear={() => console.log("Cleared")}
            activeFiltersCount={2}
          >
            <TextInput name="search" label="Search" />
          </FilterForm>
        </div>

        <div className="max-w-md">
          <SearchForm
            placeholder="Search items..."
            onSearch={(query) => console.log("Search:", query)}
          />
        </div>
      </section>

      {/* Layout Components */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Layout & Navigation</h2>
          <p className="text-sm text-muted-foreground">Layout and navigation components</p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Breadcrumbs</h3>
            <Breadcrumbs
              items={[
                { label: "Admin", href: "/admin" },
                { label: "Primitives", href: "/admin/primitives" },
                { label: "Preview" },
              ]}
            />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Status Bar</h3>
            <StatusBar variant="full" position="bottom" />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Mobile Drawer</h3>
            <MobileDrawer>
              <div className="p-4">
                <h3 className="font-semibold mb-4">Mobile Menu</h3>
                <nav className="space-y-2">
                  <a href="#" className="block p-2 hover:bg-accent rounded">
                    Home
                  </a>
                  <a href="#" className="block p-2 hover:bg-accent rounded">
                    About
                  </a>
                  <a href="#" className="block p-2 hover:bg-accent rounded">
                    Contact
                  </a>
                </nav>
              </div>
            </MobileDrawer>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Quick Switcher</h3>
            <QuickSwitcher />
            <p className="text-xs text-muted-foreground mt-1">
              Press Cmd+K (Mac) or Ctrl+K (Windows) to open
            </p>
          </div>
        </div>
      </section>

      {/* Feedback Components */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Feedback Components</h2>
          <p className="text-sm text-muted-foreground">Loading states, errors, and user feedback</p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Loading Skeletons</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Text</p>
                <LoadingSkeleton variant="text" count={3} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Card</p>
                <LoadingSkeleton variant="card" count={1} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">List</p>
                <LoadingSkeleton variant="list" count={2} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Form</p>
                <LoadingSkeleton variant="form" count={2} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Toast Patterns</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => toastPatterns.success("Success!")}>Success Toast</Button>
              <Button onClick={() => toastPatterns.error("Error occurred")}>Error Toast</Button>
              <Button onClick={() => toastPatterns.warning("Warning!")}>Warning Toast</Button>
              <Button onClick={() => toastPatterns.info("Information")}>Info Toast</Button>
              <Button onClick={() => toastPatterns.copied()}>Copied Toast</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Confirmation Dialog</h3>
            <div className="flex gap-2">
              <ConfirmationDialog
                title="Delete Item"
                description="Are you sure you want to delete this item? This action cannot be undone."
                variant="destructive"
                onConfirm={async () => {
                  await new Promise((r) => setTimeout(r, 1000));
                  toastPatterns.deleted("Item");
                }}
              />
              <ConfirmationDialog
                title="Save Changes"
                description="Do you want to save your changes?"
                confirmLabel="Save"
                onConfirm={() => toastPatterns.saved()}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Progress Indicators</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Bar</p>
                <ProgressIndicator variant="bar" value={progress} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Circular</p>
                <ProgressIndicator variant="circular" value={progress} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Steps</p>
                <ProgressIndicator
                  variant="steps"
                  value={2}
                  currentStep={2}
                  steps={[
                    { label: "Step 1", description: "Complete" },
                    { label: "Step 2", description: "Complete" },
                    { label: "Step 3", description: "In progress" },
                    { label: "Step 4", description: "Pending" },
                  ]}
                />
              </div>
            </div>
            <Button
              onClick={() => setProgress((p) => Math.min(100, p + 10))}
              size="sm"
              className="mt-2"
            >
              Increase Progress
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Error Boundary</h3>
            <ErrorBoundary>
              <div className="border rounded-lg p-4 bg-green-50 text-green-800">
                This content is protected by ErrorBoundary
              </div>
            </ErrorBoundary>
          </div>
        </div>
      </section>

      {/* Utility Components */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Utility Components</h2>
          <p className="text-sm text-muted-foreground">Reusable utility components</p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Badges</h3>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="info">Info</Badge>
              <Badge removable onRemove={() => console.log("Removed")}>
                Removable
              </Badge>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Avatars</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <Avatar size="xs" fallback="JD" />
              <Avatar size="sm" fallback="JD" />
              <Avatar size="md" fallback="JD" />
              <Avatar size="lg" fallback="JD" status="online" />
              <Avatar size="xl" fallback="JD" status="away" />
              <Avatar size="md" fallback="JD" shape="square" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Copy to Clipboard</h3>
            <div className="flex flex-wrap gap-2">
              <CopyToClipboard text="Hello World" variant="button" />
              <CopyToClipboard text="icon-variant" variant="icon" />
              <CopyToClipboard text="inline-variant" variant="inline">
                Click to copy
              </CopyToClipboard>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Tooltips</h3>
            <div className="flex gap-2">
              <Tooltip content="This is a tooltip" side="top">
                <Button variant="outline">Hover me (top)</Button>
              </Tooltip>
              <Tooltip content="Bottom tooltip" side="bottom">
                <Button variant="outline">Hover me (bottom)</Button>
              </Tooltip>
              <Tooltip content="Right tooltip" side="right">
                <Button variant="outline">Hover me (right)</Button>
              </Tooltip>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Icons</h3>
            <div className="flex flex-wrap gap-4">
              <Icon name="User" size={24} />
              <Icon name="Settings" size={24} />
              <Icon name="Search" size={24} />
              <Icon name="Bell" size={24} />
              <Icon name="Mail" size={24} />
              <Icon name="Heart" size={24} className="text-red-500" />
              <Icon name="Star" size={24} className="text-yellow-500" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
