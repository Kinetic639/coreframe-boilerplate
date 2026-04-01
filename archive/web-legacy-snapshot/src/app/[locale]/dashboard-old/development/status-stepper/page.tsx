import { StatusStepper, Step } from "@/components/ui/StatusStepper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps: Step[] = [
  { label: "Draft", value: "Draft" },
  { label: "Waiting", value: "Waiting" },
  { label: "Ready", value: "Ready" },
  { label: "Done", value: "Done" },
];

export default function StatusStepperPage() {
  return (
    <div className="container mx-auto p-8 space-y-12">
      <h1 className="text-3xl font-bold">Status Stepper Showcase</h1>

      <Card>
        <CardHeader>
          <CardTitle>Small Size</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <StatusStepper steps={steps} activeStep="Draft" size="sm" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medium (Default) Size</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <StatusStepper steps={steps} activeStep="Ready" size="md" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Large Size</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <StatusStepper steps={steps} activeStep="Done" size="lg" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>More Steps</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <StatusStepper
            steps={[
              { label: "New", value: "New" },
              { label: "Processing", value: "Processing" },
              { label: "Review", value: "Review" },
              { label: "Approved", value: "Approved" },
              { label: "Shipped", value: "Shipped" },
              { label: "Delivered", value: "Delivered" },
            ]}
            activeStep="Review"
            size="sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two Steps and Large Size</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <StatusStepper
            steps={[
              { label: "Pending", value: "Pending" },
              { label: "Completed", value: "Completed" },
            ]}
            activeStep="Pending"
            size="lg"
          />
        </CardContent>
      </Card>
    </div>
  );
}
