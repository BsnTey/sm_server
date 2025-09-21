export const isName = (string: string) => {
    return string.match(/^[А-ЯЁа-яё]{2,30}$/u);
};
