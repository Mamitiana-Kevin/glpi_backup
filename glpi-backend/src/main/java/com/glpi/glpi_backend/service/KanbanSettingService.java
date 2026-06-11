package com.glpi.glpi_backend.service;

import com.glpi.glpi_backend.model.KanbanSetting;
import com.glpi.glpi_backend.model.KanbanColorHistory;
import com.glpi.glpi_backend.repository.KanbanSettingRepository;
import com.glpi.glpi_backend.repository.KanbanColorHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Service pour les couleurs du Kanban.
 * Les labels sont maintenant gérés par KanbanLanguageService.
 *
 * Logique : toujours INSERT, jamais UPDATE.
 * La valeur courante = le dernier INSERT pour chaque clé.
 */
@Service
@RequiredArgsConstructor
public class KanbanSettingService {

    private final KanbanSettingRepository settingRepository;
    private final KanbanColorHistoryRepository colorHistoryRepository;

    // Couleurs par défaut uniquement
    private static final Map<String, String> DEFAULTS = new HashMap<>() {{
        put("color_1", "#3b82f6");
        put("color_2", "#f59e0b");
        put("color_5", "#16a34a");
    }};

    public Map<String, String> getCurrentSettings() {
        Map<String, String> result = new HashMap<>(DEFAULTS);
        for (String key : DEFAULTS.keySet()) {
            settingRepository.findLatestByKey(key)
                .ifPresent(s -> result.put(key, s.getValue()));
        }
        return result;
    }

    public Map<String, String> saveSettings(Map<String, String> newSettings, String changedBy) {
        Map<String, String> current = getCurrentSettings();

        for (Map.Entry<String, String> entry : newSettings.entrySet()) {
            String key   = entry.getKey();
            String value = entry.getValue();

            // Ignorer les clés qui ne sont pas des couleurs
            if (!key.startsWith("color_")) continue;

            KanbanSetting setting = new KanbanSetting();
            setting.setKey(key);
            setting.setValue(value);
            setting.setChangedBy(changedBy != null ? changedBy : "admin");
            settingRepository.save(setting);

            // Historique si la couleur change
            if (!value.equals(current.get(key))) {
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