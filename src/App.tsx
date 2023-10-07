import { Route, Routes } from "@solidjs/router";
import { Component, lazy } from "solid-js";
import "@total-typescript/ts-reset";

const Home = lazy(() => import("src/pages/Home"));

const App: Component = () => {
  return (
    <>
      <Routes>
        <Route path="/:roomId?" component={Home} />
      </Routes>
    </>
  );
};

export default App;
