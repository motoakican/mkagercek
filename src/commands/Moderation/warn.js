import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { WarningService } from '../../services/moderation/warningService.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("uyari")
        .setDescription("Bir kullanıcıyı uyarır")
        .addUserOption((o) =>
            o
                .setName("hedef")
                .setRequired(true)
                .setDescription("Uyarılacak kullanıcı"),
        )
        .addStringOption((o) =>
            o
                .setName("sebep")
                .setRequired(true)
                .setDescription("Uyarının sebebi"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Uyarı etkileşimi erteleme başarısız oldu`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'uyari'
            });
            return;
        }

        const target = interaction.options.getUser("hedef");
        const member = interaction.options.getMember("hedef");
        const reason = interaction.options.getString("sebep");
        const moderator = interaction.user;
        const guildId = interaction.guildId;

        if (!target) {
            throw new TitanBotError(
                'Hedef kullanıcı eksik',
                ErrorTypes.USER_INPUT,
                'Uyarılacak bir kullanıcı belirtmelisiniz.',
                { subtype: 'invalid_user' },
            );
        }

        if (!reason) {
            throw new TitanBotError(
                'Uyarı sebebi eksik',
                ErrorTypes.VALIDATION,
                'Uyarı için bir sebep belirtmelisiniz.',
                { subtype: 'missing_required' },
            );
        }

        if (!member) {
            throw new TitanBotError(
                "Hedef bulunamadı",
                ErrorTypes.USER_INPUT,
                "Hedef kullanıcı şu anda bu sunucuda bulunmuyor."
            );
        }

        ModerationService.assertModerationHierarchy(interaction.member, member, 'warn');

        const { id, totalCount } = await WarningService.addWarning({
            guildId,
            userId: target.id,
            moderatorId: moderator.id,
            reason,
            timestamp: Date.now()
        });

        await logModerationAction({
            client,
            guild: interaction.guild,
            event: {
                action: "Kullanıcı Uyarlandı",
                target: `${target.tag} (${target.id})`,
                executor: `${moderator.tag} (${moderator.id})`,
                reason,
                metadata: {
                    userId: target.id,
                    moderatorId: moderator.id,
                    totalWarns: totalCount,
                    warningNumber: totalCount,
                    warningId: id
                }
            }
        });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    `⚠️ **${target.tag}** uyarldı`,
                    `**Sebep:** ${reason}\n**Toplam Uyarı:** ${totalCount}`,
                ),
            ],
        });
    }
};