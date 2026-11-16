import { createRoot } from "react-dom/client";
import BootAnimationYou from "./components/BootAnimation_you";

function Preview() {
  const ready = new URLSearchParams(location.search).has("ready");
  return <BootAnimationYou ready={ready} onDone={() => undefined} />;
}

createRoot(document.getElementById("root")!).render(<Preview />);
