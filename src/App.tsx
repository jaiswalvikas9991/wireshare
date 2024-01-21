import { Component, lazy } from "solid-js";
import "@total-typescript/ts-reset";
import "./index.css";
import OneToOne from "./pages/OneToOne";

// const Home = lazy(() => import("src/pages/Home"));
// const Room = lazy(() => import("src/pages/Room"));

const App: Component = () => {
  return (
    <OneToOne />
  );
};

export default App;
