package com.glpi.glpi_backend.service;

import com.glpi.glpi_backend.model.KanbanSetting;
import com.glpi.glpi_backend.model.KanbanColorHistory;
import com.glpi.glpi_backend.repository.KanbanSettingRepository;
import com.glpi.glpi_backend.repository.KanbanColorHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service pour les paramètres du Kanban.
 *
 * LOGIQUE IMPORTANTE :
 * ────────────────────
 * On ne fait JAMAIS d'UPDATE sur kanban_settings.
 * Chaque changement = un nouveau INSERT.
 * La valeur courante = le dernier INSERT pour chaque clé.
 *
 * Cela permet de garder un historique complet des changements
 * directement dans la table kanban_settings.
 */
@Service
@RequiredArgsConstructor
public class KanbanSettingService {

    private final KanbanSettingRepository settingRepository;
    private final KanbanColorHistoryRepository colorHistoryRepository;

        // Valeurs par défaut si aucun enregistrement en base
    private static final Map<String, String> DEFAULTS = new HashMap<>() {{
        // Couleurs
        put("color_1", "#3b82f6");
        put("color_2", "#f59e0b");
        put("color_5", "#16a34a");

        // Labels Français (langue par défaut)
        put("label_1_fr", "Nouveau");
        put("label_2_fr", "En cours");
        put("label_5_fr", "Résolu");

        // Labels Malagasy
        put("label_1_mg", "Vaovao");
        put("label_2_mg", "Efa manao");
        put("label_5_mg", "Vita");

        // Labels Anglais
        put("label_1_en", "New");
        put("label_2_en", "In progress");
        put("label_5_en", "Resolved");
    }};

    /**
     * Récupère les paramètres actuels du Kanban.
     * Pour chaque clé, on prend le dernier INSERT.
     *
     * Retourne : { "color_1": "#3b82f6", "label_1": "Vaovao", ... }
     */
    public Map<String, String> getCurrentSettings() {
        Map<String, String> result = new HashMap<>(DEFAULTS);

        for (String key : DEFAULTS.keySet()) {
            settingRepository.findLatestByKey(key)
                .ifPresent(s -> result.put(key, s.getValue()));
        }

        return result;
    }

    /**
     * Sauvegarde de nouveaux paramètres.
     * Chaque clé = un nouveau INSERT (jamais d'UPDATE).
     * Si une couleur change, enregistre aussi dans kanban_color_history.
     *
     * @param newSettings Map des nouvelles valeurs { "color_1": "#ef4444", ... }
     * @param changedBy   Identifiant de l'utilisateur
     */
    public Map<String, String> saveSettings(Map<String, String> newSettings, String changedBy) {

        // Récupérer les valeurs actuelles pour l'historique
        Map<String, String> current = getCurrentSettings();

        for (Map.Entry<String, String> entry : newSettings.entrySet()) {
            String key   = entry.getKey();
            String value = entry.getValue();

            // INSERT du nouveau paramètre
            KanbanSetting setting = new KanbanSetting();
            setting.setKey(key);
            setting.setValue(value);
            setting.setChangedBy(changedBy != null ? changedBy : "admin");
            settingRepository.save(setting);

            // Si c'est une couleur qui change → historique
            if (key.startsWith("color_") && !value.equals(current.get(key))) {
                String statusIdStr = key.replace("color_", "");
                try {
                    Integer statusId = Integer.parseInt(statusIdStr);
                    KanbanColorHistory history = new KanbanColorHistory();
                    history.setStatusId(statusId);
                    history.setOldColor(current.getOrDefault(key, "#000000"));
                    history.setNewColor(value);
                    history.setChangedBy(changedBy != null ? changedBy : "admin");
                    colorHistoryRepository.save(history);
                } catch (NumberFormatException ignored) {}
            }
        }

        return getCurrentSettings();
    }
}
