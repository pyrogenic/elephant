import * as Router from "react-router-dom";
type RouterPaths = Router.RouteProps["path"] & Parameters<typeof Router.useRouteMatch>[0];
export default RouterPaths;
