import { Component } from "solid-js";
import './Wave.css';

const Wave: Component = () => {
  return <svg
    id="visual"
    class="w-full h-full fixed top-0 -z-1"
    preserveAspectRatio="none"
    version="1.1"
    viewBox="0 0 900 600"
  >
    <rect class="rect" y="1" width="900" height="600" fill="#fff" />
    <path
      class="fill"
      d="m0 362.48 21.5-13.251c21.5-13.251 64.5-39.753 107.3-59.63 42.9-19.877 85.5-33.128 128.4-14.198 42.8 18.93 85.8 70.042 128.6 59.252 42.9-10.601 85.5-83.293 128.4-93.704 42.8-10.412 85.8 41.457 128.6 69.474 42.9 28.017 97.793-31.277 140.69-19.919 42.8 11.358 73.507 93.368 95.007 102.64l21.5 9.0865v198.77h-900z"
      fill="#4C1D95"
      stroke-linecap="round"
      stroke-width="1.3759"
    />
    <path
      class="path"
      d="m0 362.48 21.5-13.251c21.5-13.251 64.5-39.753 107.3-59.63 42.9-19.877 85.5-33.128 128.4-14.198 42.8 18.93 85.8 70.042 128.6 59.252 42.9-10.601 85.5-83.293 128.4-93.704 42.8-10.412 85.8 41.457 128.6 69.474 42.9 28.017 97.793-31.277 140.69-19.919 42.8 11.358 73.507 93.368 95.007 102.64l21.5 9.0865"
      fill="none"
      stroke="#4C1D95"
      stroke-linecap="round"
      stroke-width="1.3758"
    />
  </svg>;
};


export default Wave;
