import { Markup } from 'telegraf';
import { CitySMEntity } from '../../../../account/entities/citySM.entity';

export const mainMenuOrderKeyboard = (city: string) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(`Изменить город: ${city}`, 'go_to_city')],
        [Markup.button.callback(`Перейти в корзину`, 'go_to_cart')],
        [Markup.button.callback(`Перейти к заказам`, 'go_to_orders')],
    ]);
};

export const getCitiesKeyboard = (cities: CitySMEntity[]) => {
    return Markup.inlineKeyboard([
        ...cities.map(city => {
            return [Markup.button.callback(`${city.fullName}`, `id_city_${city.cityId}`)];
        }),
        [Markup.button.callback('Назад', 're_enter_scene')],
    ]);
};

export const getCitiesForDeleteKeyboard = (cities: CitySMEntity[]) => {
    return Markup.inlineKeyboard([
        ...cities.map(city => {
            return [Markup.button.callback(`${city.name}`, `del_city_${city.cityId}`)];
        }),
        [Markup.button.callback('Назад', 're_enter_scene')],
    ]);
};

export const getFoundedCitiesForFavKeyboard = (cities: CitySMEntity[]) => {
    return Markup.inlineKeyboard([
        ...cities.map(city => {
            return [Markup.button.callback(`${city.fullName}`, `add_favourite_city_${city.cityId}`)];
        }),
        [Markup.button.callback('Назад', 'go_back')],
    ]);
};

export const getUserCitiesKeyboard = (userCities: CitySMEntity[]) => {
    const btns = [
        [Markup.button.callback('Добавить город в избранное', 'add_new_user_city')],
        ...userCities.map(city => {
            return [Markup.button.callback(`${city.name}`, `id_city_${city.cityId}`)];
        }),
        userCities.length != 0 ? [Markup.button.callback('Удалить город из избранного', 'del_favourite_city')] : [],
        [Markup.button.callback('Вернуться в меню', 'go_to_menu')],
    ];
    return Markup.inlineKeyboard(btns);
};

export const comebackOrderCityScene = Markup.inlineKeyboard([[Markup.button.callback('Назад', 'go_back')]]);
