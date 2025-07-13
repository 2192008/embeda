const { handleAutocomplete } = require("../../Handlers/Autocomplete");
const { slashRun } = require("../../Handlers/Command");
const { handleCreateDepartment, handleDeleteDepartment, handleEditDepartment } = require("../../Handlers/Departments");
const { handleRefreshEmbed, handleSendEmbed, handleEditEmbed, handleEmbedSave, handleDisplayEmbed } = require("../../Handlers/Embeds");
const { createPanel, editAppearance, editSelections, handleOpenTicket, handleClaimTicket, handleCloseTicket, handleReopenTicket, handleDeleteTicket } = require("../../Handlers/Tickets");

module.exports = async (client, interaction) => {
    if (!interaction.guild) return;

    if (interaction.isAutocomplete()) return await handleAutocomplete(interaction);

    if (interaction.isChatInputCommand()) return await slashRun(client, interaction);

    if (
        (interaction.isButton() && interaction.customId.startsWith("send-")) ||
        (interaction.isStringSelectMenu() && interaction.values.some(v => v.startsWith("send-")))
    ) {
        return await handleDisplayEmbed(interaction);
    }


    if (interaction.isModalSubmit() && (
        interaction.customId.startsWith("embed_modal_") ||
        interaction.customId.startsWith("field_modal_") ||
        interaction.customId.startsWith("component_modal_")
    )) {
        return await handleEditEmbed(interaction);
    }

    if (interaction.customId.startsWith("embed_save")) {
        return await handleEmbedSave(interaction)
    }


    if ((interaction.isButton() && interaction.customId === "create_department") ||
        (interaction.isModalSubmit && interaction.customId === "create_department")
    ) {
        return await handleCreateDepartment(interaction);
    }

    if (interaction.isButton() && interaction.customId.startsWith("delete_department")) return await handleDeleteDepartment(interaction);
    if (
        (interaction.isStringSelectMenu() && interaction.customId === "edit_department") ||
        (interaction.isModalSubmit() && interaction.customId.startsWith("edit_department"))
    ) {
        return await handleEditDepartment(interaction)
    }

    if (
        (interaction.isStringSelectMenu() && (
            interaction.customId === "panel_edit_selections" ||
            interaction.customId.startsWith("edit_existing_selection") ||
            interaction.customId.startsWith("edit_selection_field")
        )) ||
        (interaction.isModalSubmit() && (
            interaction.customId.startsWith("edit_add_selection") ||
            interaction.customId.startsWith("edit_remove_selection") ||
            interaction.customId.startsWith("edit_field_modal")
        )) ||
        (interaction.isButton() && (
            interaction.customId === "save_changes_selections" ||
            interaction.customId === "cancel_changes_selections"
        ))
    ) {
        return await editSelections(interaction);
    }

    if (
        (interaction.isStringSelectMenu() &&
            interaction.customId === "panel_edit_appearance") ||
        (interaction.isModalSubmit() && (
            interaction.customId === "edit_add_field" ||
            interaction.customId === "edit_remove_field" ||
            (
                interaction.customId.startsWith("edit_")
            )
        )) ||
        (interaction.isButton() && (
            interaction.customId === "save_changes_appearance" ||
            interaction.customId === "cancel_changes_appearance"
        ))
    ) {
        return await editAppearance(interaction);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_create-")) {
        return await createPanel(interaction);
    }

    if (interaction.isButton() && interaction.customId.startsWith("ticket-")) return await handleOpenTicket(interaction);
    if (interaction.isButton() && interaction.customId.startsWith("claim-")) return await handleClaimTicket(interaction);
    if (
        (interaction.isModalSubmit() && interaction.customId.startsWith("close_ticket_reason:")) ||
        (interaction.isButton() && interaction.customId.startsWith("close-"))

    ) {
        return await handleCloseTicket(interaction);
    }
    if (interaction.isButton() && interaction.customId.startsWith("reopen-")) return await handleReopenTicket(interaction);
    if (interaction.isButton() && interaction.customId.startsWith("delete-")) return await handleDeleteTicket(interaction);
};
