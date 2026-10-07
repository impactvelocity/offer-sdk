// Cancel flow SDK: a cancel button that runs the flow set up in the dashboard
// (why are you leaving? → save offer → confirm). Your server mints an account
// token with its secret key; the browser only ever holds that token.
//
//   // server
//   const { token } = await fetch(`${API}/apps/${APP}/namespaces/${userId}/token`, {
//     method: "POST", headers: { Authorization: `Bearer ${SECRET_KEY}` },
//   }).then((r) => r.json());
//
//   // client
//   <CancelFlowProvider apiUrl={API} appId={APP} token={token} onCancelled={…}>
//     <CancelFlow.Trigger>Cancel subscription</CancelFlow.Trigger>
//     <CancelFlow.Dialog />
//   </CancelFlowProvider>
export { CancelClient } from "./client";
export { CancelFlow, offerSummary } from "./components";
export { CancelFlowProvider, useCancelFlow, type CancelFlowContextValue, type CancelFlowProviderProps, type CancelPhase } from "./provider";
export type {
  CancelConfig,
  CancelSession,
  CancelStatus,
  CancelStep,
  CancelTransport,
  ConfirmStep,
  OfferStep,
  QuestionStep,
  SaveOffer,
  SaveOfferDetails,
  SaveOfferKind,
  TextStep,
} from "./types";
