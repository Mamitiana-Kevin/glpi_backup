package com.glpi.glpi_backend.controller;

import com.glpi.glpi_backend.model.TicketSuperCost;
import com.glpi.glpi_backend.service.TicketSuperCostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/ticket-super-cost")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class TicketSuperCostController {

    private final TicketSuperCostService service;

    @PostMapping
    public ResponseEntity<TicketSuperCost> save(@RequestBody Map<String, Object> body) {
        Integer ticketId = (Integer) body.get("ticketId");
        Double superCost = ((Number) body.get("superCost")).doubleValue();
        
        return ResponseEntity.ok(service.save(ticketId, superCost));
    }

    @GetMapping("/{ticketId}")
    public ResponseEntity<TicketSuperCost> getByTicketId(@PathVariable Integer ticketId) {
        Optional<TicketSuperCost> cost = service.findByTicketId(ticketId);
        return cost.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/total")
    public ResponseEntity<Double> getTotal() {
        return ResponseEntity.ok(service.getTotalSuperCost());
    }
}
