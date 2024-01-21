import { createRoom } from "$src/ServerUtils";
import RocketSvg from "$src/components/RocketSvg";
import { useNavigate } from "@solidjs/router";
import { Component, createSignal } from "solid-js";

const Home: Component = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = createSignal<string>('');

  const handleRoomCreation = async () => {
    const roomId = await createRoom();
    navigate(`/${roomId}`);
  };

  const handleJoinroom = () => {
    navigate(`/${roomId()}`);
  };

  return (
    <div class="h-screen w-screen flex flex-col relative">

      <div class="navbar bg-base-100">
        <div class="navbar-start">
          <span class="flex flex-row items-start">
            <div class="pt-3">
              <RocketSvg />
            </div>
            <div class="flex flex-col p-2">
              <strong class="normal-case text-xl md:text-2xl">Wireshare</strong>
              <p class="font-semibold pb-2 text-xs md:text-sm text-success">
                BETA
              </p>
            </div>
          </span>
        </div>
      </div>

      <div class="flex-1 flex items-center justify-center">
        <div class="card sm:w-11/12 md:w-96 bg-base-100 shadow-xl">
          <div class="card-body items-center text-center">
            <input type="text" placeholder="Room id" class="input input-bordered input-primary w-full max-w-xs" value={roomId()} onchange={e => setRoomId(e.currentTarget.value)} />
            <button class="btn btn-primary" onclick={handleJoinroom}>Join Room</button>
            <div class="divider">OR</div>
            <button class="btn btn-primary" onclick={handleRoomCreation}>Create Room</button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;
