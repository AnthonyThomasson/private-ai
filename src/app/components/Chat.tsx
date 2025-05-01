import Image from "next/image";

export default function Chat() {
  return (
    <div className="p-5">
      <div className="flex flex-col gap-5">
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
                Bonnie Green
              </span>
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                11:46
              </span>
            </div>
            <p className="text-sm font-normal py-2.5 text-gray-900 dark:text-white">
              That&apos;s awesome. I think our users will really appreciate the
              improvements.
            </p>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              Delivered
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 justify-end">
          <div className="flex flex-col w-full max-w-[320px] leading-1.5 p-4 border-gray-200 bg-gray-100 rounded-tl-xl rounded-bl-xl rounded-br-xl rounded-none dark:bg-gray-700">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Bonnie Green
              </span>
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                11:46
              </span>
            </div>
            <p className="text-sm font-normal py-2.5 text-gray-900 dark:text-white">
              That&apos;s awesome. I think our users will really appreciate the
              improvements.
            </p>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              Delivered
            </span>
          </div>
          <Image
            className="w-8 h-8 rounded-full"
            src="/example.png"
            alt="Jese image"
            width={32}
            height={32}
          />
        </div>
      </div>
    </div>
  );
}
