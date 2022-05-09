import React from "react";
import ReactDOM from "react-dom";
import Elephant from "./Elephant";
import reportWebVitals from "./reportWebVitals";
import "react-datepicker/dist/react-datepicker.css";
import "./index.scss";

ReactDOM.render(
  <React.StrictMode>
    <Elephant />
  </React.StrictMode>,
  document.getElementById("root"),
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(console.log);

// TODO: React 18
/*
import React from "react";
import { createRoot } from "react-dom/client";
import Elephant from "./Elephant";
import reportWebVitals from "./reportWebVitals";
import "react-datepicker/dist/react-datepicker.css";
import "./index.scss";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Elephant />
    </React.StrictMode>,
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(console.log);
*/
