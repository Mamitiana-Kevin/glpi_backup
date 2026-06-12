package com.glpi.glpi_backend.service;

import com.glpi.glpi_backend.model.TicketSuperCost;
import com.glpi.glpi_backend.repository.TicketSuperCostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TicketSuperCostService {

    private final TicketSuperCostRepository repository;

    public TicketSuperCost save(Integer ticketId, Double superCost) {
        Optional<TicketSuperCost> existing = repository.findByTicketId(ticketId);

        TicketSuperCost cost;
        if (existing.isPresent()) {
            cost = existing.get();
            cost.setSuperCost(superCost);
        } else {
            cost = new TicketSuperCost();
            cost.setTicketId(ticketId);
            cost.setSuperCost(superCost);
        }

        return repository.save(cost);
    }

    public Optional<TicketSuperCost> findByTicketId(Integer ticketId) {
        return repository.findByTicketId(ticketId);
    }

    public Double getTotalSuperCost() {
        return repository.findAll().stream()
            .mapToDouble(TicketSuperCost::getSuperCost)
            .sum();
    }
}
