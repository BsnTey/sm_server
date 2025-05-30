export function WrapWithLoading() {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        if (typeof originalMethod !== 'function') {
            throw new TypeError(
                `Декоратор @WrapWithLoading может быть применен только к методам, не к ${typeof originalMethod} '${propertyKey}'.`,
            );
        }

        descriptor.value = async function (...args: any[]) {
            if (typeof (this as any).wrapperFuncLoading !== 'function') {
                throw new Error(
                    `Метод 'wrapperFuncLoading' не определен или это не функция на инстансе для '${propertyKey}'. Проверь BottService класс.`,
                );
            }
            return (this as any).wrapperFuncLoading(() => originalMethod.apply(this, args));
        };

        return descriptor;
    };
}
