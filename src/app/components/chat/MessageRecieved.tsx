import { Person } from "@/db/models/people";
import { Message } from "@/db/models/messages";
import Image from "next/image";

interface Props {
  message: Message & {
    sender?: Person;
    receiver?: Person;
  };
}

export default function MessageRecieved({ message }: Props) {
  return (
    <div className="flex items-start gap-2.5">
      <Image
        className="w-8 h-8 rounded-full"
        src="/example.png"
        alt="Jese image"
        width={32}
        height={32}
      />
      <div className="flex flex-col w-full max-w-[320px] leading-1.5 p-4 border-gray-200 bg-gray-100 rounded-e-xl rounded-es-xl dark:bg-gray-700">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {message.sender?.name || "Unknown"}
          </span>
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            11:46
          </span>
        </div>
        <p className="text-sm font-normal py-2.5 text-gray-900 dark:text-white">
          {message.content}
        </p>
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          Delivered
        </span>
      </div>
    </div>
  );
}
