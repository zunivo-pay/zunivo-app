import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Create from "./pages/Create";
import Pay from "./pages/Pay";
import Dashboard from "./pages/Dashboard";
import Receipt from "./pages/Receipt";
import Names from "./pages/Names";
import Send from "./pages/Send";
import Shell from "./lib/Shell";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell><Create /></Shell>} />
        <Route path="/pay" element={<Shell dark><Pay /></Shell>} />
        <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
        <Route path="/r/:id" element={<Shell dark><Receipt /></Shell>} />
        <Route path="/names" element={<Shell dark><Names /></Shell>} />
        <Route path="/send" element={<Shell><Send /></Shell>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
