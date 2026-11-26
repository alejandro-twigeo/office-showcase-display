import "@fontsource-variable/familjen-grotesk";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "./integrations/supabase/client";

const render = () => createRoot(document.getElementById("root")!).render(<App />);

// Coming back from the "Log in" button in the login email: the address carries the login
// (#access_token=… or ?code=…). Let the login finish first, then open the Play page.
// Without this, the app's own #/page addresses and the login data would clash.
const { hash, search } = window.location;
const fromLoginEmail = /(^#|&)(access_token|error_description)=/.test(hash) || /[?&]code=/.test(search);

if (fromLoginEmail) {
  supabase.auth
    .getSession()
    .catch(() => undefined)
    .finally(() => {
      window.history.replaceState(null, "", `${window.location.pathname}#/play`);
      render();
    });
} else {
  render();
}
