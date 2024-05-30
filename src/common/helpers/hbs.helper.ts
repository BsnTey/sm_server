import * as hbs from 'handlebars';

export const handlebarsHelpers = {
    digitSeparator: (value: number) => {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },
    formatDate: (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const months = [
            'января',
            'февраля',
            'марта',
            'апреля',
            'мая',
            'июня',
            'июля',
            'августа',
            'сентября',
            'октября',
            'ноября',
            'декабря',
        ];
        return `${date.getDate()} ${months[date.getMonth()]}, ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    },
    formatDateRange: (startDateString: string, endDateString: string) => {
        if (!startDateString) return '';
        const startDate = new Date(startDateString);
        const months = [
            'января',
            'февраля',
            'марта',
            'апреля',
            'мая',
            'июня',
            'июля',
            'августа',
            'сентября',
            'октября',
            'ноября',
            'декабря',
        ];
        const formattedStartDate = `${startDate.getDate()} ${months[startDate.getMonth()]}, ${startDate.getHours()}:${startDate.getMinutes().toString().padStart(2, '0')}`;

        if (!endDateString) return formattedStartDate;
        const endDate = new Date(endDateString);
        const formattedEndDate = `${endDate.getDate()} ${months[endDate.getMonth()]}, ${endDate.getHours()}:${endDate.getMinutes().toString().padStart(2, '0')}`;

        return `${formattedStartDate} - ${formattedEndDate}`;
    },
    getPaymentStatus: (isPayed: boolean) => {
        return isPayed ? 'Оплачен' : 'Не оплачен';
    },
    getItemName: (count: number) => {
        const numItems: { [key: number]: string } = {
            1: 'товар',
            2: 'товара',
            3: 'товара',
            4: 'товара',
            5: 'товаров',
        };
        return numItems[count] || numItems[5];
    },
    formatPhone: (phone: string) => {
        const phoneStr = phone.toString();
        return phoneStr.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    },
    divide: (value: number, divisor: number) => {
        return value / divisor;
    },
    trim: (str: string) => {
        return str.trim();
    },
    equals: (a: any, b: any) => {
        return a === b;
    },
    extractTrackNumber: (trackUrl: string) => {
        if (!trackUrl) return '';
        const parts = trackUrl.split('?');
        return parts[1] || '';
    },
    removeImagePath: (url: string) => {
        if (!url) return '';
        return url.replace('/{width}_{height}_{hash}', '');
    },
    or: (a: any, b: any) => {
        return a || b;
    },
};

Object.entries(handlebarsHelpers).forEach(([name, fn]) => {
    hbs.registerHelper(name, fn);
});
