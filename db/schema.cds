namespace my.bookshop;

using { cuid, managed, sap.common.Currencies} from '@sap/cds/common';

entity Books : cuid, managed {
  title               : String(111);
  descr               : String(500);
  author              : Association to Authors;
  category            : Association to Categories;
  isbn                : String(20);
  coverImageURL       : String(500);
  price               : Decimal(9,2);
  currency            : Association to Currencies;
  discountPercentage  : Decimal(5,2);
  stock               : Integer;
  unitsSold           : Integer;
  averageRating       : Decimal(3,2);
}

entity Authors : cuid, managed {
  name       : String(111);
  biography  : String(1000);
  books      : Association to many Books on books.author = $self;
}

entity Categories : cuid, managed {
  name        : String(111);
  description : String(500);
  books       : Association to many Books on books.category = $self;
}

entity Orders : cuid, managed {
  orderNumber  : String(20);
  totalPrice   : Decimal(9,2);
  currency     : String(3);
  status       : String(20) default 'PLACED';
  items        : Composition of many OrderItems on items.order = $self;
}

entity OrderItems : cuid, managed {
  order     : Association to Orders;
  book      : Association to Books;
  quantity  : Integer;
  netAmount : Decimal(9,2);
}
entity Wishlist {
  key ID   : UUID;
  book     : Association to Books;
  userName : String;
}