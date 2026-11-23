package com.bookshop.services;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.sap.cds.ql.Select;
import com.sap.cds.ql.Update;
import com.sap.cds.services.ErrorStatuses;
import com.sap.cds.services.cds.CdsCreateEventContext;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.Before;
import com.sap.ccds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;
import com.sap.cds.services.ServiceException;

import cds.gen.orderservice.Orders;
import cds.gen.orderservice.OrderItems;
import cds.gen.orderservice.Orders_;
import cds.gen.orderservice.Books;
import cds.gen.orderservice.Books_;

@Component
@ServiceName("OrderService")
public class OrderServiceHandler implements EventHandler {

    @Autowired
    private PersistenceService db;

    @Before(event = CdsCreateEventContext.CDS_EVENT_NAME, entity = Orders_.CDS_NAME)
    public void onOrderCreate(CdsCreateEventContext context, Orders order) {
        if (order.getItems() == null || order.getItems().isEmpty()) {
            return;
        }

        BigDecimal totalAmount = BigDecimal.ZERO;

        for (OrderItems item : order.getItems()) {
            // Resolve book ID whether posted as FK or via association
            String sBookId = item.getBookId();
            if (sBookId == null && item.getBook() != null) {
                sBookId = item.getBook().getID();
            }

            Integer iOrderedQty = item.getQuantity();
            if (sBookId == null || iOrderedQty == null || iOrderedQty <= 0) {
                throw new ServiceException(ErrorStatuses.BAD_REQUEST,
                    "Each order item requires a valid book and a positive quantity.");
            }

            Books book = db.run(Select.from(Books_.class)
                            .where(b -> b.ID().eq(sBookId)))
                    .first(Books.class)
                    .orElseThrow(() -> new ServiceException(ErrorStatuses.NOT_FOUND,
                        "Book not found: " + sBookId));

            int iCurrentStock = book.getStock() != null ? book.getStock() : 0;

            if (iCurrentStock < iOrderedQty) {
                throw new ServiceException(ErrorStatuses.CONFLICT,
                    "Insufficient stock for '" + book.getTitle() + "'. Available: "
                    + iCurrentStock + ", Requested: " + iOrderedQty);
            }

            // Calculate line total
            BigDecimal unitPrice = book.getPrice() != null ? book.getPrice() : BigDecimal.ZERO;
            item.setNetAmount(unitPrice.multiply(BigDecimal.valueOf(iOrderedQty)));
            totalAmount = totalAmount.add(item.getNetAmount());

            // Decrement stock via the WRITABLE orders-service projection
            db.run(Update.entity(Books_.class)
                    .data(Books.STOCK, iCurrentStock - iOrderedQty)
                    .where(b -> b.ID().eq(sBookId)));
        }

        // Set order-level financial data
        order.setTotalPrice(totalAmount);
        String currency = order.getItems().stream()
            .map(i -> i.getBook() != null ? i.getBook().getCurrencyCode() : null)
            .filter(Objects::nonNull).findFirst().orElse(null);
        order.setCurrency(currency);
        order.setOrderNumber("ORD-" + UUID.randomUUID().toString().substring(0, 8));
    }
}