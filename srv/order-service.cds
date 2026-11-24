using { my.bookshop as my } from '../db/schema';

@path: 'orders'
service OrderService {
    entity Orders as projection on my.Orders;
    entity OrderItems as projection on my.OrderItems;
    entity Books as projection on my.Books;

    entity Wishlist as projection on my.Wishlist {
        *,
        book : redirected to Books
    };

    entity CartItems as projection on my.CartItems {
        *,
        book : redirected to Books
    };
}