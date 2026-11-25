// Node does not provide the Workers runtime module. Tests pass database and
// asset bindings directly to worker.fetch; production uses Cloudflare's module.
import {registerHooks} from "node:module";
const moduleUrl="data:text/javascript,export const env=Object.freeze({});";
registerHooks({
  resolve(specifier,context,nextResolve){
    return specifier==="cloudflare:workers"
      ? {url:moduleUrl,shortCircuit:true}
      : nextResolve(specifier,context);
  }
});
