export interface OrderApiWebhook {
    id: string;
    count: string;
    category: Category;
    user: User;
    botUser: BotUser;
    product: Product;
    status: string;
    price: string;
    amount: string;
    created_at: string;
    discount: string;
}

interface Category {
    id: string;
    category_id: string;
    parent: ParentCategory;
    design: Design;
    price: Price;
    setting: Setting;
    type: string;
    typeObg: TypeObject;
    status: string;
    is_view: string;
    is_hide: string;
    api_id: string;
}

interface ParentCategory {
    id: string;
    category_id: string;
    design: Design;
    price: Price;
    setting: Setting;
    type: string;
    typeObg: TypeObject;
    status: string;
    is_view: string;
    is_hide: string;
}

interface Design {
    title: string;
    description: string;
    instruction?: string;
    template_id: string;
    deployed: string;
    count: string;
    discount: string;
    discount_text: string;
}

interface Price {
    full: string;
    amount: string;
    currency: Currency;
    discount: string;
    old_price: string;
}

interface Currency {
    id: string;
    code: string;
    letter: string;
}

interface Setting {
    min_count: string;
    max_count: string;
    count: string;
    is_ban_coupon: string;
    is_change_count: string;
    is_block_feedback: string;
    is_view_ordered_user: string;
}

interface TypeObject {
    id: string;
    title: string;
}

interface User {
    id: string;
    telegram_id: string;
    username: string;
    first_name: string;
    last_name: string;
    link: string;
    type: string;
}

interface BotUser {
    id: string;
    bot_id: string;
    user: User;
    money: string;
    status: BotUserStatus;
    create_at: string;
    created_time: string;
    update_at: string;
    updated_time: string;
}

interface BotUserStatus {
    id: string;
    title: string;
}

interface Product {
    type: string;
    data: string;
}
