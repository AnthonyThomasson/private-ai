import Chat from "./components/Chat";
import MurderDetails from "./components/MurderDetails";

export default function Home() {
  return (
    <div className="flex">
      <div className="w-1/4 bg-gray-200">
        <MurderDetails />
      </div>
      <div className="w-2/4 bg-gray-300">
        <Chat />
      </div>
      <div className="w-1/4 bg-gray-400">
        <h1>Section 3</h1>
      </div>
    </div>
  );
}
