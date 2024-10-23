import { Transition } from "@headlessui/react";
import { resolveValue, Toaster } from "react-hot-toast";

export default function CustomToaster() {
  return (
    <Toaster position="bottom-center" reverseOrder={true}>
      {(t) => (
        <Transition
          appear
          as="div"
          show={t.visible}
          enter="transition-all duration-150"
          enterFrom="opacity-0 scale-50"
          enterTo="opacity-100 scale-100"
          leave="transition-all duration-150"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-75"
        >
          {resolveValue(t.message, t)}
        </Transition>
      )}
    </Toaster>
  );
}
