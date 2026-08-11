import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('kayit')
        .setDescription('Bir kullanıcının kaydını yapar ve rollerini düzenler')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addUserOption((option) =>
            option
                .setName('kullanici')
                .setDescription('Kaydı yapılacak kullanıcı')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('isim')
                .setDescription('Kullanıcının adı')
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName('yas')
                .setDescription('Kullanıcının yaşı')
                .setMinValue(5)
                .setMaxValue(100)
                .setRequired(true),
        ),
    category: 'Moderation',

    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction, { ephemeral: true });

        const targetUser = interaction.options.getUser('kullanici');
        const name = interaction.options.getString('isim');
        const age = interaction.options.getInteger('yas');

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return await replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Bu kullanıcı sunucuda bulunamadı.',
            });
        }

        try {
            // 1. İsim ve Yaş Ayarlama (Örn: Emre | 15)
            const newNickname = `${name} | ${age}`;
            await member.setNickname(newNickname);

            // 2. Rolleri Ayarlama (Sunucunuzdaki rol isimleriyle birebir aynı olmalıdır)
            const unverifiedRoleName = 'Kayıtsız';
            const registeredRoleName = 'Kayıtlı';
            const specialRoleName = "Allah'ın Aslanı";

            const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === unverifiedRoleName);
            const registeredRole = interaction.guild.roles.cache.find(r => r.name === registeredRoleName);
            const specialRole = interaction.guild.roles.cache.find(r => r.name === specialRoleName);

            // Rol işlemleri (Kayıtsız rolü alınır, Kayıtlı ve özel rol verilir)
            if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
                await member.roles.remove(unverifiedRole);
            }
            if (registeredRole) {
                await member.roles.add(registeredRole);
            }
            if (specialRole) {
                await member.roles.add(specialRole);
            }

            const embed = successEmbed(
                'Kayıt Başarılı!',
                `**${targetUser.tag}** adlı kullanıcının kaydı tamamlandı!\n\n` +
                `👤 **Yeni İsim:** \`${newNickname}\`\n` +
                `🎭 **Verilen Roller:** ${registeredRole ? registeredRole.name : 'Bulunamadı'}, ${specialRole ? specialRole.name : 'Bulunamadı'}\n` +
                `🗑️ **Alınan Rol:** ${unverifiedRole ? unverifiedRole.name : 'Bulunamadı'}`
            );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            logger.info(`${interaction.user.tag} tarafından ${targetUser.tag} başarıyla kaydedildi.`);

        } catch (error) {
            logger.error('Kayıt komutu çalıştırılırken hata oluştu:', error);
            return await replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: 'Kullanıcı kayıt edilirken bir hata oluştu. Botun yetkilerinin ve rol sıralamasının yeterli olduğundan emin olun.',
            });
        }
    },
};
