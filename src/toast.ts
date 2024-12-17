import toast from 'solid-toast';

export const toastInfo = (msg: string) => {
    toast(msg, {position: 'bottom-right'});
};

