using { my.bookshop as my } from '../db/schema';

@path: 'orders'
service OrderService {
    entity Orders as projection on my.Orders;
    entity OrderItems as projection on my.OrderItems;
    
    entity Wishlist as projection on my.Wishlist {
        *,
        book : redirected to Books
    };

    entity Books as projection on my.Books;
}