import Loader from "@/components/ui/Loader";

export default function QRRedirectLoading() {
  return (
    <Loader
      fullScreen
      message="Please wait while we redirect you to the correct page."
      className="bg-background"
    />
  );
}
