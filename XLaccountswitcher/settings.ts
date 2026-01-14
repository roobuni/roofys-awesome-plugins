import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    accounts: {
        type: OptionType.STRING,
        default: "[]",
        description: "Stored accounts",
        hidden: true
    },
    invalidAccounts: {
        type: OptionType.STRING,
        default: "[]",
        description: "Invalid accounts",
        hidden: true
    },
    pinnedAccounts: {
        type: OptionType.STRING,
        default: "[]",
        description: "Pinned account IDs",
        hidden: true
    },
    showConfirmation: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Confirm before switching"
    }
});
