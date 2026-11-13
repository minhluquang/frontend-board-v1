// Re-export root App component and Requests feature helpers for backwards compatibility
export { App as default, App } from "./app/App";
export {
  RequestsBoard as Board,
  parseUrlState,
  syncUrlState,
  type BoardState,
} from "./features/requests";
